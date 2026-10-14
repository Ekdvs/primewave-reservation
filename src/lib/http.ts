import { NextRequest, NextResponse } from "next/server";
import { AppError, isOverlapViolation } from "./errors";
import { ZodError, ZodTypeAny, z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export type Ctx = {
    params : Promise<Record<string, string>>
}

type Handler = (req: NextRequest, ctx: Ctx) => Promise<Response>

export const ok = <T>(data: T, status = 200) => {
    return NextResponse.json(data, { status });
}

export const created = <T>(data: T) => {
    return NextResponse.json(data, { status: 201 });
}

export function route(handler: Handler):Handler {
    return async (req, ctx) => {
        try {
            return await handler(req, ctx);
        } catch (e) {
            console.error(e);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
    };
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

function err(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function toErrorResponse(e: unknown) {
  if (isOverlapViolation(e)) {
    return err(409, "BOOKING_CONFLICT", "This time slot overlaps with an existing reservation");
  }
  if (e instanceof ZodError) {
    return err(
      400,
      "VALIDATION_ERROR",
      "Invalid input",
      e.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }
  if (e instanceof AppError) return err(e.status, e.code, e.message, e.details);
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return err(409, "DUPLICATE", "A record with these values already exists");
    if (e.code === "P2025") return err(404, "NOT_FOUND", "Record not found");
    if (e.code === "P2003") return err(409, "IN_USE", "Record is referenced by other data");
  }
  console.error(e);
  return err(500, "INTERNAL_ERROR", "Something went wrong");
}