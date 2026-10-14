import { route, ok } from "@/lib/http";
import { Errors } from "@/lib/errors";
import { runMaintenance } from "@/service/maintenance.service";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw Errors.unauthorized("Invalid cron secret");
  }
  return ok(await runMaintenance());
});