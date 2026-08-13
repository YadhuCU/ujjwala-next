import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const CreateUserSchema = z.object({
  username: z.string().trim().min(3).max(40),
  name: z.string().trim().min(1),
  password: z.string().min(8),
  email: z.preprocess(emptyToUndefined, z.email().optional()),
  mobile: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  userRoles: z.array(z.number().int()).min(1),
});

// Username is immutable; an absent password leaves the existing hash in place.
export const UpdateUserSchema = z.object({
  name: z.string().trim().min(1),
  password: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
  email: z.preprocess(emptyToUndefined, z.email().optional()),
  mobile: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  userRoles: z.array(z.number().int()).min(1),
});

export const SetUserActiveSchema = z.object({
  isActive: z.boolean(),
});

export const UserQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  isActive: z
    .preprocess(emptyToUndefined, z.enum(["true", "false"]).optional())
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type SetUserActiveInput = z.infer<typeof SetUserActiveSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
