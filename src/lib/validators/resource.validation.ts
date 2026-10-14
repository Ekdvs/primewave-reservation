import { z } from "zod";
import { hhmm, pagination } from "./index.validation";


const resourceFields = z.object({
    name: z.
        string().
        trim().
        min(2).
        max(100),

    categoryId: z.
        string().
        min(1),

    description: z.
        string().
        trim().
        max(500).
        nullish(),

    location: z.
        string().
        trim().
        max(120).
        nullish(),

    capacity: z.
        number().
        int().
        positive().
        max(100000).
        nullish(),

    status: z.
        enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),

    openTime: hhmm,

    closeTime: hhmm,

    maxDurationMins: z.
        number().
        int().
        min(15).
        max(1440),

    requiresApproval: z.
        boolean(),
});

const hoursOk = (d: { openTime?: string; closeTime?: string }) =>
    !d.openTime || !d.closeTime || d.openTime < d.closeTime;

export const createResourceSchema = resourceFields
    .partial()
    .required({ name: true, categoryId: true })
    .refine(hoursOk, { message: "closeTime must be after openTime", path: ["closeTime"] });

export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = resourceFields
    .partial()
    .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" })
    .refine(hoursOk, { message: "closeTime must be after openTime", path: ["closeTime"] });

export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

export const resourceQuerySchema = z.object({
    q: z.
        string().
        trim().
        optional(),

    categoryId: z.
        string().
        optional(),

    status: z.
        enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]).optional(),
    ...pagination,
});

export const availabilityQuerySchema = z.object({
    date: z.
        string().
        regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});