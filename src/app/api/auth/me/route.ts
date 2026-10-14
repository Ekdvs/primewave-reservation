import { requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export const GET = route(
    async (request) => {
        return ok(await requireUser(request));

    }
)