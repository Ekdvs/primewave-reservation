import { requireUser } from "@/lib/auth";
import { Errors } from "@/lib/errors";
import { ok, route } from "@/lib/http";
import prisma from "@/lib/prisma";

export const POST = route(async (req, { params }) => {
    const user = await requireUser(req);
    const { id } = await params;

    const res = await prisma.notification.updateMany({
        where: { id, userId: user.id, readAt: null },
        data: { readAt: new Date() },
    });
    if (res.count === 0) {
        const exists = await prisma.notification.findFirst(
            {
                where: {
                    id,
                    userId: user.id
                }
            }
        );
        if (!exists) {
            throw Errors.notFound("Notification");
        }
    }
    return ok(
        {
            read: true
        });
});