import { requireAdmin, requireUser } from "@/lib/auth";
import { created, ok, parseBody, parseQuery, route } from "@/lib/http";
import { createResourceSchema, resourceQuerySchema } from "@/lib/validators/resource.validation";
import { createResource, ListResource } from "@/service/resource.service";

export const GET = route(
    async(request) => {
        await requireUser(request);

        const body = parseQuery(request,resourceQuerySchema);

        const resources = await ListResource(body);

        return ok(resources);
    }
)

export const POST = route(
    async(request) => {
        const admin = await requireAdmin(request);
        const body = await parseBody(request, createResourceSchema);

        const resource = await createResource(admin,body)

        return created(resource);
    }

)