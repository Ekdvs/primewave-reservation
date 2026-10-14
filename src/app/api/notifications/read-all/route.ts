import { requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";
import prisma from "@/lib/prisma";


export const POST = route(async (req) => {
    const user = await requireUser(req);

    const res = await prisma.notification.updateMany({
        where: {
            userId: user.id,
            readAt: null
        },
        data: {
            readAt: new Date()
        },
    });
    return ok({
        updated: res.count
    });
});