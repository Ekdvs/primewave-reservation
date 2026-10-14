import { route } from "@/lib/http";
import { NextResponse } from "next/server";

const COOKIE = "auth-token";

export const POST = route(
    async () => {
        const response = NextResponse.json({
            data:{loggedOut:true},
            success:true,
        },{status:200})

        response.cookies.set(COOKIE,"",{
            path:"/",
            maxAge:0,
        })

        return response;
    }
)
    
