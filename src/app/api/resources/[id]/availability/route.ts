import { requireUser } from "@/lib/auth";
import { ok, parseQuery, route } from "@/lib/http";
import { availabilityQuerySchema } from "@/lib/validators/resource.validation";
import { getAvailability } from "@/service/resource.service";

export const GET = route(async (request, { params }) => {
  const user = await requireUser(request);

  const { id } = await params;

  const {date}= parseQuery(request, availabilityQuerySchema);

  const resource = await getAvailability(id,date,user.id);

  return ok(resource);
});