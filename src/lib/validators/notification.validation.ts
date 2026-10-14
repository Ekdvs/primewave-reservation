import { z } from "zod";
import { pagination } from "./index.validation";

export const notificationQuerySchema = z.object({
  unread: z.
        enum(["true", "false"]).
        optional(),
  ...pagination,
});
