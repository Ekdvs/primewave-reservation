import { z } from "zod";
import { isoDateTime, pagination } from "./index.validation";


export const createReservationSchema = z
  .object({
    resourceId: z
        .string()
        .min(1),

    title: z
        .string()
        .trim()
        .min(3)
        .max(120),

    purpose: z
        .string()
        .trim()
        .max(500)
        .optional(),

    startTime: isoDateTime,

    endTime: isoDateTime,

    attendees: z
         .number()
         .int()
         .positive()
         .max(100000)
         .optional(),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const reservationQuerySchema = z.object({
  scope: z
        .enum(["mine", "all"])
        .default("mine"),

  status: z
        .enum(["PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED"])
        .optional(),

  resourceId: z
        .string()
        .optional(),

  from: isoDateTime.optional(),

  to: isoDateTime.optional(),

  ...pagination,
});

export const decisionSchema = z
  .object({
    action: z
        .enum(["approve", "reject"]),

    reason: z
        .string()
        .trim()
        .min(3)
        .max(300)
        .optional(),

  })
  .refine((d) => d.action !== "reject" || !!d.reason, {
    message: "reason is required when rejecting",
    path: ["reason"],
  });

export const notificationQuerySchema = z.object({
  unread: z
  .enum(["true", "false"])
  .optional(),
  
  ...pagination,
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

