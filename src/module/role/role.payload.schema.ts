import { z } from "zod";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

// The catalogue is closed: a role may only hold codes the application actually
// checks. Anything else would be a checkbox that grants nothing.
const permissionCodes = Object.values(PERMISSIONS) as [Permission, ...Permission[]];

export const PermissionCodeSchema = z.enum(permissionCodes);

const nameSchema = z
  .string()
  .trim()
  .min(2, "Role name must be at least 2 characters")
  .max(50, "Role name must be at most 50 characters")
  // Role names end up in the session and in guards, so keep them predictable.
  .regex(
    /^[A-Za-z0-9 _-]+$/,
    "Role name may only contain letters, numbers, spaces, hyphens and underscores",
  );

const descriptionSchema = z
  .string()
  .trim()
  .max(200, "Description must be at most 200 characters")
  .optional();

// `isSystem` is deliberately absent: it is set by the seed and never accepted
// from a client, or anyone could mint themselves an unrestricted role.
export const CreateRoleSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  permissionCodes: z.array(PermissionCodeSchema).default([]),
});

export const UpdateRoleSchema = CreateRoleSchema;

export const RoleQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type RoleQuery = z.infer<typeof RoleQuerySchema>;
