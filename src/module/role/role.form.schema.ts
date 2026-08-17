import { z } from "zod";

export const RoleFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must be at most 50 characters")
    .regex(
      /^[A-Za-z0-9 _-]+$/,
      "Only letters, numbers, spaces, hyphens and underscores",
    ),
  description: z
    .string()
    .trim()
    .max(200, "Description must be at most 200 characters")
    .optional(),
  permissionCodes: z.array(z.string()),
});

export type RoleFormValues = z.infer<typeof RoleFormSchema>;
