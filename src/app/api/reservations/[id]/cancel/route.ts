import { route, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { cancelReservation } from "@/service/reservation.service";

export const POST = route(async (req, { params }) => {
    const user = await requireUser(req);
    const { id } = await params;
    const reservation = await cancelReservation(user, id);

    return ok(reservation);
});