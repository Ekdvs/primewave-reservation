import { z } from "zod";

export const registerSchema = z.object({
    name: z.
        string().
        trim().
        min(2).
        max(80).
        regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),

    email: z.
        string().
        trim().
        toLowerCase().
        email("Invalid email address").
        regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),

    password: z.
        string().
        trim().
        min(8).
        max(72).
        regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,72}$/, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),

    department: z.
        string().
        trim().
        max(80).
        optional(),
});

export const loginSchema = z.object({
    email: z.
        string().
        trim().
        toLowerCase().
        email("Invalid email address"),

    password: z.
        string().
        trim().
        min(1),
});
