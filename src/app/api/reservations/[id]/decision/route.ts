import { route, ok, parseBody } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { decideReservation } from "@/service/reservation.service";
import { decisionSchema } from "@/lib/validators/reservation.validation";

export const POST = route(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const body = await parseBody(req, decisionSchema)
  const reservation = await decideReservation(admin, id,body)
  return ok(reservation);
});