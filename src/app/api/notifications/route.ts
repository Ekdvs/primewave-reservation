import { requireUser } from "@/lib/auth";
import { ok, parseQuery, route } from "@/lib/http";
import prisma from "@/lib/prisma";
import { notificationQuerySchema } from "@/lib/validators/reservation.validation";



export const GET = route(
    async (request) => {
        const user = await requireUser(request);
        const q = parseQuery(request, notificationQuerySchema);
        const where = {
            userId: user.id,
            ...(q.unread === "true" && { readAt: null })
        };

        const [items, total, unreadCount] = await prisma.$transaction([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (q.page - 1) * q.limit,
                take: q.limit,
            }),
            prisma.notification.count({ where }),

            prisma.notification.count({
                where: {
                    userId: user.id,
                    readAt: null
                }
            }),
        ]);
        return ok({
            items,
            meta: {
                page: q.page,
                limit: q.limit,
                total,
                unreadCount
            }
        });
    }
)