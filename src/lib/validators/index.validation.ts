import { z } from "zod";

export const hhmm = z.
    string().
    regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");

export const isoDateTime = z.
    string().
    datetime({ offset: true });

export const pagination = {
  page: z.
    coerce.
        number().
        int().
        min(1).
        default(1),

  limit: z.
    coerce.
        number().
        int().
        min(1).
        max(100).
        default(20),
};