import { route, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/service/dashboard.service";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const data = await getDashboard();
  return ok(data);
})

  