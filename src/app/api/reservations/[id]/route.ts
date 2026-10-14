import { requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";
import { getReservation } from "@/service/reservation.service";


export const GET = route(
    async(request, {params})=>{
        const user = await requireUser(request);
        const { id } =await  params; 

        const reservation =await getReservation(user, id);

        return ok(reservation);


    }
)