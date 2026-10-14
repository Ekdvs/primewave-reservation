import { requireAdmin, requireUser } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";
import { updateResourceSchema } from "@/lib/validators/resource.validation";
import { deleteResource, GetResource, updateResource } from "@/service/resource.service";

export const GET = route(async (request, { params }) => {
  await requireUser(request);

  const { id } = await params;

  return ok(await GetResource(id));
});



export const PATCH = route(async (request, { params }) => {
  const admin =await requireAdmin(request);

  const { id } = await params;

  const body = await parseBody(request, updateResourceSchema);

  const resource = await updateResource(admin, id, body);

  return ok(resource);
});

export const DELETE = route(async (request, { params }) => {
  const admin = await requireAdmin(request);

  const { id } = await params;

  await deleteResource(admin, id);
  
  return ok({ deleted: true });
});