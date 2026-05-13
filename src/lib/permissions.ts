export const PERMISSIONS = {
  USER_CREATE: "user:create",
  USER_READ: "user:read",
  USER_DELETE: "user:delete",
  USER_UPDATE: "user:update",
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]