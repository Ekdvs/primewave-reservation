import { hashPassword } from "@/lib/auth";
import { Errors } from "@/lib/errors";
import { parseBody, route } from "@/lib/http";
import prisma from "@/lib/prisma";
import { registerSchema } from "@/lib/validators/auth.validation";
import { NextResponse } from "next/server";

export const POST = route(async (request) => {
    const body = await parseBody(request, registerSchema);

    //find if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
    });

    if (existingUser) {
        throw  Errors.conflict("EMAIL_TAKEN","User with this email already exists");
    }

    //default role is MEMBER
    const user = await prisma.user.create({
        data:{
            name: body.name,
            email: body.email,
            passwordHash: await hashPassword(body.password),
            role: "MEMBER",
            department: body.department,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
        }
    })

    const response = NextResponse.json({
        data:{user},
        success: true,
    }, { status: 201 })

    return response;

    })
