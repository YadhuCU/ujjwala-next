import { z } from "zod";

export const DashboardQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
