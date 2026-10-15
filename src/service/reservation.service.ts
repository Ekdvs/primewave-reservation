import { Prisma, Resource } from "@/generated/prisma/client";
import { AuthUser } from "@/lib/auth";
import { AppError, Errors, isOverlapViolation } from "@/lib/errors";
import { adminIds, audit, notify } from "@/lib/notify";
import prisma from "@/lib/prisma";
import { hhmmToMin, toLocal } from "@/lib/time";
import { CreateReservationInput } from "@/lib/validators/reservation.validation";



const include = {
    resource: {
        select: {
            id: true,
            name: true,
            location: true
        }
    },
    user: {
        select: {
            id: true,
            name: true,
            email: true,
        }
    }
} satisfies Prisma.ReservationInclude

const ACTIVE = ["PENDING", "CONFIRMED"] as const

function validateRules(resourse: Resource, start: Date, end: Date, attendees?: number) {

    if (start.getTime() < Date.now() - 60_000) {
        throw Errors.unprocessable("PAST_TIME", "Cannot book a time in the past")
    }

    const mins = (end.getTime() - start.getTime()) / 60_000

    if (mins > resourse.maxDurationMins) {
        throw Errors.unprocessable("MAX_DURATION_EXCEEDED", `Maximum booking duration is ${resourse.maxDurationMins} minutes`);
    }

    if (resourse.capacity && attendees && attendees > resourse.capacity) {
        throw Errors.unprocessable("CAPACITY_EXCEEDED", `Capacity is ${resourse.capacity}`);
    }

    const starttime = toLocal(start);
    const endtime = toLocal(end)

    if (starttime.date !== endtime.date) {
        throw Errors.unprocessable("MULTI_DAY_NOT_ALLOWED", "Reservation must start and end on the same day");
    }

    if (starttime.minutes < hhmmToMin(resourse.openTime) || endtime.minutes > hhmmToMin(resourse.closeTime)) {
        throw Errors.unprocessable("OUTSIDE_OPERATING_HOURS", `Operating hours are ${resourse.openTime} - ${resourse.closeTime}`);
    }
}

const conflictError = async (resourceId: string, start: Date, end: Date) => {
  const conflicts = await prisma.reservation.findMany({
    where: {
      resourceId,
      status: { in: [...ACTIVE] },
      startTime: { lt: end },
      endTime: { gt: start },
    },
    select: { startTime: true, endTime: true, status: true },
    orderBy: { startTime: "asc" },
  });
  return new AppError(409, "BOOKING_CONFLICT", "This time slot overlaps with an existing reservation", { conflicts });
};

export const createReservation = async (user: AuthUser, input: CreateReservationInput) => {

    const resource = await prisma.resource.findUnique({
        where: {
            id: input.resourceId
        }
    })

    if (!resource) {
        throw Errors.notFound("Resource");
    }

    if (resource.status !== "ACTIVE") {
        throw Errors.conflict("RESOURCE_UNAVAILABLE", `Resource is currently ${resource.status.toLowerCase()}`);
    }

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    validateRules(resource, start, end, input.attendees);

    const status = resource.requiresApproval && user.role !== "ADMIN" ? "PENDING" : "CONFIRMED";

    try {
        return await prisma.$transaction(async (tx) => {
            const reservation = await tx.reservation.create({
                data: {
                    title: input.title,
                    purpose: input.purpose,
                    attendees: input.attendees,
                    startTime: start,
                    endTime: end,
                    status,
                    resourceId: resource.id,
                    userId: user.id,
                },
                include,
            });

            await notify(tx, [user.id], {
                type: "RESERVATION_CREATED",
                title: status === "PENDING" ? "Reservation submitted" : "Reservation confirmed",
                message: `${resource.name}: ${reservation.title}${status === "PENDING" ? " is awaiting approval." : " is confirmed."}`,
                reservationId: reservation.id,
            });
            if (status === "PENDING") {
                const admins = (await adminIds(tx)).filter((id) => id !== user.id);
                await notify(tx, admins, {
                    type: "RESERVATION_CREATED",
                    title: "Approval required",
                    message: `${user.name} requested ${resource.name}: ${reservation.title}`,
                    reservationId: reservation.id,
                });
            }
            await audit(tx, user.id, "RESERVATION_CREATED", "Reservation", reservation.id, { status });

            return reservation;
        });

    } catch (error) {
        if (isOverlapViolation(error)) throw await conflictError(resource.id, start, end);
        throw error;
    }

}

export const listReservations = async (
    user: AuthUser,
    q: {
        scope: "mine" | "all";
        status?: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "COMPLETED";
        resourceId?: string;
        from?: string;
        to?: string;
        page: number;
        limit: number;
    }
) => {
    if (q.scope === "all" && user.role !== "ADMIN") throw Errors.forbidden("Admin access required");

    const where: Prisma.ReservationWhereInput = {
        ...(q.scope === "mine" && { userId: user.id }),
        ...(q.status && { status: q.status }),
        ...(q.resourceId && { resourceId: q.resourceId }),
        ...(q.from && { endTime: { gt: new Date(q.from) } }),
        ...(q.to && { startTime: { lt: new Date(q.to) } }),
    };

    const [items, total] = await prisma.$transaction([
        prisma.reservation.findMany({
            where,
            include,
            orderBy: { startTime: "desc" },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma.reservation.count({ where }),
    ]);
    return {
        items,
        meta: {
            page: q.page,
            limit: q.limit,
            total,
            pages: Math.ceil(total / q.limit)

        }
    };

}

export const getReservation = async (user: AuthUser, id: string) => {
    const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: {
            ...include,
            decidedBy: {
                select: {
                    id: true,
                    name: true,
                }
            }
        }
    })

    if (!reservation) {
        throw Errors.notFound("Reservation");
    }

    if (user.role !== "ADMIN" && reservation.userId !== user.id) {
        throw Errors.forbidden();
    }
    return reservation

}

export const cancelReservation = async (user: AuthUser, id: string) => {
    const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: { resource: true }
    })

    if (!reservation) {
        throw Errors.notFound("Reservation");
    }

    const isAdmin = user.role === "ADMIN";

    if (!isAdmin && reservation.userId !== user.id) {
        throw Errors.forbidden();
    }

    if (!ACTIVE.includes(reservation.status as (typeof ACTIVE)[number])) {
        throw Errors.conflict("INVALID_STATE", `Cannot cancel a ${reservation.status.toLowerCase()} reservation`);
    }

    if (!isAdmin && reservation.startTime <= new Date()) {
        throw Errors.conflict("ALREADY_STARTED", "Cannot cancel a reservation that has already started");
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.reservation.update({ where: { id }, data: { status: "CANCELLED" }, include });
        await notify(tx, [reservation.userId], {
            type: "RESERVATION_CANCELLED",
            title: "Reservation cancelled",
            message: `${reservation.resource.name}: ${reservation.title} was cancelled${isAdmin && reservation.userId !== user.id ? " by an administrator" : ""}.`,
            reservationId: id,
        });
        await audit(tx, user.id, "RESERVATION_CANCELLED", "Reservation", id);
        return updated;
    });
}

export const decideReservation = async(
    admin:AuthUser,
    id:string,
    decide:{
        action:"approve"|"reject"; reason?:string
    }
)=>{
    const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: { resource: true }
    })

    if (!reservation) {
        throw Errors.notFound("Reservation");
    }

    if (reservation.status !== "PENDING") {
        throw Errors.conflict("INVALID_STATE", `Only pending reservations can be decided (current: ${reservation.status.toLowerCase()})`);
    }

    const approve = decide.action === "approve";

    return prisma.$transaction(async (tx) => {

    // updateMany with status guard prevents double-decision races
    const res = await tx.reservation.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: approve ? "CONFIRMED" : "REJECTED",
        decidedById: admin.id,
        rejectReason: approve ? null : decide.reason,
      },
    });

    if (res.count === 0) throw Errors.conflict("INVALID_STATE", "Reservation was already decided");

    await notify(tx, [reservation.userId], {
      type: approve ? "RESERVATION_CONFIRMED" : "RESERVATION_REJECTED",
      title: approve ? "Reservation approved" : "Reservation rejected",
      message: approve
        ? `${reservation.resource.name}: ${reservation.title} is confirmed.`
        : `${reservation.resource.name}: ${reservation.title} was rejected. Reason: ${decide.reason}`,
      reservationId: id,
    });

    await audit(tx, admin.id, approve ? "RESERVATION_APPROVED" : "RESERVATION_REJECTED", "Reservation", id, {
      reason: decide.reason ?? null,
    });

    return tx.reservation.findUniqueOrThrow({ 
        where: { id }, 
        include 
    });
  });

}