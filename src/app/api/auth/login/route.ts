import { setAuthCookie, signToken, verfiyPassword } from "@/lib/auth";
import { Errors } from "@/lib/errors";
import { parseBody, route } from "@/lib/http";
import prisma from "@/lib/prisma";
import { loginSchema } from "@/lib/validators/auth.validation";
import { NextResponse } from "next/server";


export const POST = route(async (request) => {

    const { email, password } = await parseBody(request, loginSchema);

    //find user by email
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user || !(await verfiyPassword(password, user.passwordHash))) {
        throw Errors.unauthorized("Invalid email or password");
    }

    const userData = {
        id: user.id,
        role: user.role,

    }

    const token = await signToken(userData);
    const response = NextResponse.json({
        data: { user: userData },
        success: true,
    }, { status: 200 });

    setAuthCookie(response, token);
    return response;
})