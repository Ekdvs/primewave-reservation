import { Role } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { NextRequest, NextResponse } from "next/server";
import prisma from "./prisma";
import { Errors } from "./errors";



export const COOKIE = "token"

const secret = () => {
    return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export const hashPassword = (password: string) => {
    return bcrypt.hash(password, 10)
}

export const verfiyPassword = (password: string, hash: string) => {
    return bcrypt.compare(password, hash)
}

export async function signToken(user: { id: string; role: Role }) {
    return new SignJWT({ role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret());
}

export function setAuthCookie(res: NextResponse, token: string) {
    res.cookies.set(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });
}

export async function getCurrentUser(req: NextRequest) {
    const token =
        req.cookies.get(COOKIE)?.value ??
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secret());
        return await prisma.user.findUnique({
            where: { id: String(payload.sub) },
            select: { id: true, name: true, email: true, role: true, department: true },
        });
    } catch {
        return null;
    }
}

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(req: NextRequest): Promise<AuthUser> {
    const user = await getCurrentUser(req);
    if (!user) throw Errors.unauthorized();
    return user;
}

export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
    const user = await requireUser(req);
    if (user.role !== "ADMIN") throw Errors.forbidden("Admin access required");
    return user;
}