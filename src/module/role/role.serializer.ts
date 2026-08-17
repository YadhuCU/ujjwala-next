import { PERMISSION_REGISTRY, type Permission } from "@/lib/permissions";

export type RoleWithRelations = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  rolePermissions: { permission: { code: string } }[];
  _count: { userRoles: number };
};

export type RoleResponse = {
  id: number;
  name: string;
  description?: string;
  isSystem: boolean;
  permissionCodes: Permission[];
  permissionCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

export function serializeRole(role: RoleWithRelations): RoleResponse {
  // A system role is allowed everything in code, whatever its rows happen to
  // say, so report what is actually true rather than what the seed last wrote.
  const permissionCodes = role.isSystem
    ? PERMISSION_REGISTRY.map((entry) => entry.code)
    : role.rolePermissions.map(
        (rolePermission) => rolePermission.permission.code as Permission,
      );

  return {
    id: role.id,
    name: role.name,
    description: role.description ?? undefined,
    isSystem: role.isSystem,
    permissionCodes,
    permissionCount: permissionCodes.length,
    userCount: role._count.userRoles,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

export function serializeRoles(roles: RoleWithRelations[]): RoleResponse[] {
  return roles.map(serializeRole);
}
