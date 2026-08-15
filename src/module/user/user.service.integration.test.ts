import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { makeRole, makeUserWithRoles } from "@/test/factories";
import * as UserService from "./user.service";

let ownerRoleId: number;
let staffRoleId: number;

beforeEach(async () => {
  ownerRoleId = (await makeRole(ROLES.OWNER)).id;
  staffRoleId = (await makeRole(ROLES.OFFICE_STAFF)).id;
});

function userInput(roleIds: number[], overrides: Record<string, unknown> = {}) {
  return {
    username: "newuser",
    name: "New User",
    password: "supersecret",
    email: undefined,
    mobile: undefined,
    userRoles: roleIds,
    ...overrides,
  };
}

describe("createUser", () => {
  it("hashes the password and attaches the roles", async () => {
    const user = await UserService.createUser(userInput([staffRoleId]));

    expect(user.password).not.toBe("supersecret");
    expect(await bcrypt.compare("supersecret", user.password)).toBe(true);
    expect(user.userRoles.map((r) => r.role.name)).toEqual([
      ROLES.OFFICE_STAFF,
    ]);
  });

  it("rejects a role id that does not exist", async () => {
    await expect(
      UserService.createUser(userInput([9999])),
    ).rejects.toThrow(/Invalid role/);

    expect(await prisma.user.count()).toBe(0);
  });
});

describe("updateUser", () => {
  it("keeps the existing hash when no password is supplied", async () => {
    const created = await UserService.createUser(userInput([staffRoleId]));

    const updated = await UserService.updateUser(created.id, {
      name: "Renamed",
      password: undefined,
      email: undefined,
      mobile: undefined,
      userRoles: [staffRoleId],
    });

    expect(updated.password).toBe(created.password);
    expect(updated.name).toBe("Renamed");
  });

  it("re-hashes when a new password is supplied", async () => {
    const created = await UserService.createUser(userInput([staffRoleId]));

    const updated = await UserService.updateUser(created.id, {
      name: "New User",
      password: "a-different-one",
      email: undefined,
      mobile: undefined,
      userRoles: [staffRoleId],
    });

    expect(updated.password).not.toBe(created.password);
    expect(await bcrypt.compare("a-different-one", updated.password)).toBe(
      true,
    );
  });

  it("replaces roles rather than accumulating them", async () => {
    const created = await UserService.createUser(userInput([staffRoleId]));

    const updated = await UserService.updateUser(created.id, {
      name: "New User",
      password: undefined,
      email: undefined,
      mobile: undefined,
      userRoles: [ownerRoleId],
    });

    expect(updated.userRoles.map((r) => r.role.name)).toEqual([ROLES.OWNER]);
  });
});

// Locking every owner out of the app is unrecoverable without database access,
// so these three guards are the ones worth pinning hardest.
describe("last active owner", () => {
  it("cannot be deleted", async () => {
    const owner = await makeUserWithRoles([ownerRoleId], "Only Owner");
    const other = await makeUserWithRoles([staffRoleId], "Staff");

    await expect(
      UserService.deleteUser(owner.id, other.id),
    ).rejects.toThrow(/last active owner/);
  });

  it("cannot be deactivated", async () => {
    const owner = await makeUserWithRoles([ownerRoleId], "Only Owner");
    const other = await makeUserWithRoles([staffRoleId], "Staff");

    await expect(
      UserService.setUserActive(owner.id, false, other.id),
    ).rejects.toThrow(/last active owner/);
  });

  it("cannot be demoted out of the owner role", async () => {
    const owner = await makeUserWithRoles([ownerRoleId], "Only Owner");

    await expect(
      UserService.updateUser(owner.id, {
        name: "Only Owner",
        password: undefined,
        email: undefined,
        mobile: undefined,
        userRoles: [staffRoleId],
      }),
    ).rejects.toThrow(/last active owner/);
  });

  it("gives way once a second owner exists", async () => {
    const first = await makeUserWithRoles([ownerRoleId], "Owner One");
    const second = await makeUserWithRoles([ownerRoleId], "Owner Two");

    const deleted = await UserService.deleteUser(first.id, second.id);
    expect(deleted.isDeleted).toBe(true);
  });

  // An inactive owner cannot log in, so they do not count as cover
  it("does not count a deactivated owner as the second owner", async () => {
    const active = await makeUserWithRoles([ownerRoleId], "Active Owner");
    const dormant = await makeUserWithRoles([ownerRoleId], "Dormant Owner");
    await prisma.user.update({
      where: { id: dormant.id },
      data: { isActive: false },
    });

    await expect(
      UserService.deleteUser(active.id, dormant.id),
    ).rejects.toThrow(/last active owner/);
  });
});

describe("acting on your own account", () => {
  it("refuses self-deletion", async () => {
    const user = await makeUserWithRoles([staffRoleId], "Staff");

    await expect(UserService.deleteUser(user.id, user.id)).rejects.toThrow(
      /your own account/,
    );
  });

  it("refuses self-deactivation", async () => {
    const user = await makeUserWithRoles([staffRoleId], "Staff");

    await expect(
      UserService.setUserActive(user.id, false, user.id),
    ).rejects.toThrow(/your own account/);
  });

  it("allows reactivating yourself", async () => {
    const user = await makeUserWithRoles([staffRoleId], "Staff");

    const result = await UserService.setUserActive(user.id, true, user.id);
    expect(result.isActive).toBe(true);
  });
});

describe("deleteUser", () => {
  it("soft-deletes and deactivates so the login is closed too", async () => {
    const user = await makeUserWithRoles([staffRoleId], "Staff");
    const actor = await makeUserWithRoles([ownerRoleId], "Owner");

    await UserService.deleteUser(user.id, actor.id);

    const deleted = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.isActive).toBe(false);
  });

  it("hides deleted users from the list", async () => {
    const user = await makeUserWithRoles([staffRoleId], "Staff");
    const actor = await makeUserWithRoles([ownerRoleId], "Owner");

    await UserService.deleteUser(user.id, actor.id);

    const { data, meta } = await UserService.getUsers({
      page: 1,
      limit: 20,
      search: undefined,
      isActive: undefined,
    });
    expect(data.map((u) => u.id)).toEqual([actor.id]);
    expect(meta.total).toBe(1);
  });
});
