import { describe, expect, it } from "vitest";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserQuerySchema,
} from "./user.payload.schema";

const validUser = {
  username: "office",
  name: "Office Staff",
  password: "supersecret",
  email: "office@example.com",
  mobile: "9876543210",
  userRoles: [2],
};

describe("CreateUserSchema", () => {
  it("accepts a complete user", () => {
    expect(CreateUserSchema.safeParse(validUser).success).toBe(true);
  });

  it("requires a password of at least 8 characters", () => {
    const result = CreateUserSchema.safeParse({
      ...validUser,
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one role", () => {
    const result = CreateUserSchema.safeParse({ ...validUser, userRoles: [] });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = CreateUserSchema.safeParse({
      ...validUser,
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("treats an empty email as absent rather than invalid", () => {
    const parsed = CreateUserSchema.parse({ ...validUser, email: "" });

    expect(parsed.email).toBeUndefined();
  });
});

describe("UpdateUserSchema", () => {
  // A blank password on the edit form means "keep the current one", so it must
  // parse to undefined instead of failing the length rule.
  it("allows a blank password and drops it", () => {
    const parsed = UpdateUserSchema.parse({
      name: "Office Staff",
      password: "",
      userRoles: [2],
    });

    expect(parsed.password).toBeUndefined();
  });

  it("still enforces the length when a password is supplied", () => {
    const result = UpdateUserSchema.safeParse({
      name: "Office Staff",
      password: "short",
      userRoles: [2],
    });

    expect(result.success).toBe(false);
  });

  it("does not carry username, which is immutable after creation", () => {
    const parsed = UpdateUserSchema.parse({
      name: "Office Staff",
      username: "hacker",
      userRoles: [2],
    });

    expect("username" in parsed).toBe(false);
  });
});

describe("UserQuerySchema", () => {
  it("turns the isActive query string into a boolean", () => {
    expect(UserQuerySchema.parse({ isActive: "true" }).isActive).toBe(true);
    expect(UserQuerySchema.parse({ isActive: "false" }).isActive).toBe(false);
    expect(UserQuerySchema.parse({}).isActive).toBeUndefined();
  });
});
