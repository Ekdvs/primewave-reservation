import { requireUser } from "@/lib/auth";
import { created, ok, parseBody, parseQuery, route } from "@/lib/http";
import { createReservationSchema, reservationQuerySchema } from "@/lib/validators/reservation.validation";
import { createReservation, listReservations } from "@/service/reservation.service";


export const GET = route(
    async(request)=>{
        const user = await requireUser(request);
        const body = parseQuery(request, reservationQuerySchema);

        const reservations = await listReservations(user, body);

        return ok(reservations);
    }
)

export const POST = route(
    async(request)=>{
        const user = await requireUser(request);
        const body = await parseBody(request, createReservationSchema);

        const reservation = await createReservation(user, body);

        return created(reservation);
    }
)