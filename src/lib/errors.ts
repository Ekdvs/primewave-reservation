export class AppError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
        public details?: unknown
    ) {
        super(message);
    }
}

export const Errors = {
    unauthorized: (msg = "Authentication required") => new AppError(401, "UNAUTHORIZED", msg),
    forbidden: (msg = "You do not have permission") => new AppError(403, "FORBIDDEN", msg),
    notFound: (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`),
    conflict: (code: string, msg: string, details?: unknown) => new AppError(409, code, msg, details),
    unprocessable: (code: string, msg: string, details?: unknown) => new AppError(422, code, msg, details),
};

export function isOverlapViolation(e: unknown): boolean {
    const msg = e instanceof Error ? e.message : String(e);
    return msg.includes("reservation_no_overlap") || msg.includes("23P01");
}