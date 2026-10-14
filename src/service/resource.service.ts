import { Prisma } from "@/generated/prisma/client";
import { AuthUser } from "@/lib/auth";
import { AppError, Errors } from "@/lib/errors";
import { audit, notify } from "@/lib/notify";
import prisma from "@/lib/prisma";
import { hhmmToMin, localMidnightUtc } from "@/lib/time";
import { CreateResourceInput, UpdateResourceInput } from "@/lib/validators/resource.validation";



const include = {
    category: true
} satisfies Prisma.ResourceInclude;


//list resources with optional filters
export const ListResource = async (q: {
    q?: string,
    categoryId?: string,
    status?: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
    page?: number,
    limit?: number
}) => {

    const where: Prisma.ResourceWhereInput =
    {
        ...(q.categoryId && { categoryId: q.categoryId }),
        ...(q.status && { status: q.status }),
        ...(q.q && {
            OR: [
                { name: { contains: q.q, mode: "insensitive" } },
                { location: { contains: q.q, mode: "insensitive" } }
            ]
        })
    }

    const [items, total] = await prisma.$transaction([
        prisma.resource.findMany({
            where,
            include,
            orderBy: { name: "asc" },
            skip: ((q.page ?? 1) - 1) * (q.limit ?? 20),
            take: q.limit ?? 20
        }),
        prisma.resource.count({ where })
    ])

    return {
        items,
        meta: {
            page: q.page,
            limit: q.limit,
            total,
            pages: Math.ceil(total / (q.limit ?? 20))
        }
    }
}

//get a single resource by id
export const GetResource = async (id: string) => {
    const resource = await prisma.resource.findUnique({
        where: { id },
        include
    })

    if (!resource) {
        throw Errors.notFound("Resource");
    }

    return resource;
}


// Create a new resource
export const createResource = async (
    admin: AuthUser,
    data: CreateResourceInput
) => {
    const category = await prisma.resourceCategory.findUnique({
        where: { id: data.categoryId },
    });

    if (!category) {
        throw Errors.notFound("Category");
    }

    const { categoryId, ...resourceData } = data;

    return prisma.$transaction(async (tx) => {
        const resource = await tx.resource.create({
            data: {
                ...resourceData,
                category: {
                    connect: { id: categoryId },
                },
            },
            include,
        });

        await audit(
            tx,
            admin.id,
            "CREATE_RESOURCE",
            "Resource",
            resource.id,
            { name: resource.name }
        );

        return resource;
    });
};

//update a resource
export const updateResource = async (
    admin: AuthUser,
    id: string,
    data: UpdateResourceInput
) => {

    const existingResource = await prisma.resource.findUnique({
        where: { id },
    });

    if (!existingResource) {
        throw Errors.notFound("Resource");
    }

    const open = data.openTime ?? existingResource.openTime;
    const close = data.closeTime ?? existingResource.closeTime;

    if (hhmmToMin(open) >= hhmmToMin(close)) {
        throw Errors.unprocessable("INVALID_HOURS", "closeTime must be after openTime");
    }

    if (data.categoryId) {
        const category = await prisma.resourceCategory.findUnique({
            where: { id: data.categoryId },
        });

        if (!category) {
            throw Errors.notFound("Category");
        }
    }

    return prisma.$transaction(async (tx) => {
        const resource = await tx.resource.update({
            where: { id },
            data: data as Prisma.ResourceUncheckedUpdateInput,
            include,
        })

        // Tell affected users when a resource goes out of service
        if (data.status && data.status !== existingResource.status && data.status === "ACTIVE") {
            const affected = await tx.reservation.findMany({
                where: {
                    resourceId: id,
                    status: { in: ["PENDING", "CONFIRMED"] },
                    startTime: { gt: new Date() }
                },
                select: { userId: true, id: true },
            });
            await notify(tx, affected.map((a) => a.userId), {
                type: "RESOURCE_STATUS_CHANGED",
                title: "Resource status changed",
                message: `${resource.name} is now ${data.status.toLowerCase()}. Your upcoming reservation may be affected.`,
            });
        }
        await audit(tx, admin.id, "RESOURCE_UPDATED", "Resource", id, data as Prisma.InputJsonValue);

        return resource;
    })


}

//delete a resource
export const deleteResource = async (admin: AuthUser, id: string) => {
    const count = await prisma.reservation.count({
        where: { resourceId: id }
    });

    if (count > 0) {
        throw new AppError(
            409,
            "RESOURCE_HAS_RESERVATIONS",
            "Resource has reservation history. Set its status to INACTIVE instead."
        );
    }
    await prisma.$transaction(async (tx) => {
        await tx.resource.delete({ where: { id } });
        await audit(tx, admin.id, "RESOURCE_DELETED", "Resource", id);
    });
}

export const getAvailability = async (resourceId: string, date: string, viewerId: string) => {

    const resource = await prisma.resource.findUnique({
        where: { id: resourceId }
    });

    if (!resource) throw Errors.notFound("Resource");

    const dayStart = localMidnightUtc(date);

    const open = new Date(dayStart.getTime() + hhmmToMin(resource.openTime) * 60_000);
    const close = new Date(dayStart.getTime() + hhmmToMin(resource.closeTime) * 60_000);

    const bookings = await prisma.reservation.findMany({
        where: {
            resourceId,
            status: { in: ["PENDING", "CONFIRMED"] },
            startTime: { lt: close },
            endTime: { gt: open },
        },
        orderBy: { startTime: "asc" },
        select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
            userId: true
        },
    });

    const freeSlots: { start: Date; end: Date }[] = [];
    let cursor = open;
    for (const b of bookings) {
        if (b.startTime > cursor) freeSlots.push({
            start: cursor,
            end: b.startTime
        });
        if (b.endTime > cursor) cursor = b.endTime;
    }
    if (cursor < close) freeSlots.push({
        start: cursor,
        end: close
    });

    return {
        resourceId,
        date,
        status: resource.status,
        openTime: resource.openTime,
        closeTime: resource.closeTime,
        bookings: bookings.map(({ userId, ...b }) => ({ ...b, mine: userId === viewerId })),
        freeSlots: resource.status === "ACTIVE" ? freeSlots : [],
    };
}