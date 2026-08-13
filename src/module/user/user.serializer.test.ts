import { describe, expect, it } from "vitest";
import { serializeUser, type UserWithRelations } from "./user.serializer";

function buildUser(overrides: Partial<UserWithRelations> = {}) {
  return {
    id: 1,
    uuid: "uuid-1",
    username: "owner",
    name: "Owner User",
    password: "$2b$10$averyrealbcrypthash",
    isActive: true,
    email: null,
    mobile: null,
    isDeleted: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    userRoles: [
      {
        id: 10,
        userId: 1,
        roleId: 5,
        role: {
          id: 5,
          name: "OWNER",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      },
    ],
    ...overrides,
  } as unknown as UserWithRelations;
}

describe("serializeUser", () => {
  // The serializer is the only path a User takes to a response, so this is the
  // single place the password hash is kept out of the API.
  it("never includes the password hash", () => {
    const result = serializeUser(buildUser());

    expect("password" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain("bcrypthash");
  });

  it("flattens roles to id and name", () => {
    const result = serializeUser(buildUser());

    expect(result.userRoles).toEqual([{ id: 5, name: "OWNER" }]);
  });

  it("maps nullable columns to undefined so they drop out of JSON", () => {
    const result = serializeUser(buildUser({ email: null, mobile: null }));

    expect(result.email).toBeUndefined();
    expect(result.mobile).toBeUndefined();
  });
});
