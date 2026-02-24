export const USER_ROLES = ["Owner", "Office", "Sales"] as const;
export type UserRole = typeof USER_ROLES[number];
