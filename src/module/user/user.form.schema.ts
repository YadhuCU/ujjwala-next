import { z } from "zod";

const emptyToUndefined = (value: string) =>
  value.trim() === "" ? undefined : value;

const BaseUserFormSchema = z.object({
  name: z.string("Name is required").trim().min(1, "Name is required"),

  email: z
    .string()
    .trim()
    .transform((v) => emptyToUndefined(v))
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, "Invalid email"),

  mobile: z
    .string()
    .trim()
    .transform((v) => emptyToUndefined(v))
    .optional(),

  userRoles: z.array(z.number().int()).min(1, "User role is required"),
});

export const UserCreateFormSchema = BaseUserFormSchema.extend({
  username: z
    .string("Username is required")
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(40, "Username cannot exceed 40 characters"),

  password: z
    .string("Password is required")
    .min(8, "Password must be at least 8 characters"),
});

// On edit the username is fixed and a blank password means "leave it alone".
export const UserUpdateFormSchema = BaseUserFormSchema.extend({
  username: z.string().optional(),

  password: z
    .string()
    .transform((v) => emptyToUndefined(v))
    .optional()
    .refine(
      (v) => !v || v.length >= 8,
      "Password must be at least 8 characters",
    ),
});

export type UserFormValues = z.infer<typeof UserCreateFormSchema>;
