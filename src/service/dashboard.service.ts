import prisma from "@/lib/prisma";
import { localMidnightUtc, toLocal } from "@/lib/time";



export const getDashboard = async () => {
    const now = new Date();
    const dayStart = localMidnightUtc(toLocal(now).date);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const since = new Date(now.getTime() - 30 * 86_400_000);

    const [resourcesByStatus, reservationsByStatus, todayCount, pendingApprovals, top] = await Promise.all([
        prisma.resource.groupBy({ 
            by: ["status"],
             _count: { _all: true } 
        }),

        prisma.reservation.groupBy({ 
            by: ["status"], 
            _count: { _all: true } 
        }),

        prisma.reservation.count({
            where: { 
                status: { 
                    in: ["PENDING", "CONFIRMED"] 
                }, 
                startTime: { 
                    gte: dayStart, 
                    lt: dayEnd 
                } 
            },
        }),
        prisma.reservation.count({ 
            where: { 
                status: "PENDING" 
            } 
        }),

        prisma.reservation.groupBy({
            by: ["resourceId"],
            where: { 
                status: { 
                    in: ["CONFIRMED", "COMPLETED"] 
                }, 
                startTime: { 
                    gte: since 
                } 
            },
            _count: { 
                _all: true 
            },
            orderBy: { 
                _count: { 
                    resourceId: "desc" 
                } 
            },
            take: 5,
        }),
    ]);

    const names = await prisma.resource.findMany({
        where: { 
            id: { 
                in: top.map((t) => t.resourceId) 
            } 
        },
        select: { 
            id: true, 
            name: true 
        },
    });
    const nameOf = new Map(names.map((n) => [n.id, n.name]));

    return {
        resources: Object.fromEntries(resourcesByStatus.map((r) => [r.status, r._count._all])),
        reservations: Object.fromEntries(reservationsByStatus.map((r) => [r.status, r._count._all])),
        todayReservations: todayCount,
        pendingApprovals,
        topResourcesLast30Days: top.map((t) => ({
            resourceId: t.resourceId,
            name: nameOf.get(t.resourceId) ?? "Unknown",
            reservations: t._count._all,
        })),
    };
}