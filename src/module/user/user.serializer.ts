import { Prisma } from "@/generated/client";

export type UserWithRelations = Prisma.UserGetPayload<{
  include: { userRoles: { include: { role: true } } };
}>;

// The password hash must never leave the server — it is stripped here, and this
// serializer is the only way a User reaches a response.
export function serializeUser(user: UserWithRelations) {
  const { password: _password, userRoles, ...rest } = user;
  void _password;

  return {
    ...rest,
    name: rest.name ?? undefined,
    email: rest.email ?? undefined,
    mobile: rest.mobile ?? undefined,
    userRoles: userRoles.map((x) => ({ id: x.role.id, name: x.role.name })),
  };
}

export function serializeUsers(users: UserWithRelations[]) {
  return users.map(serializeUser);
}

export type UserResponse = ReturnType<typeof serializeUser>;
