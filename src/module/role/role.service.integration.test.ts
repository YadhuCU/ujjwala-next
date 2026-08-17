import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { makeUser, syncPermissionCatalogue } from "@/test/factories";
import * as RoleService from "./role.service";

// Real rows: the audit log's actor is a foreign key, so a fabricated id fails.
let ownerId: number;
let adminId: number;

const owner = () => ({ userId: ownerId, permissions: [], isOwner: true });

const limitedAdmin = (permissions: (typeof PERMISSIONS)[keyof typeof PERMISSIONS][]) => ({
  userId: adminId,
  permissions,
  isOwner: false,
});

const input = (over: Partial<Parameters<typeof RoleService.createRole>[0]> = {}) => ({
  name: "Accountant",
  description: undefined,
  permissionCodes: [],
  ...over,
});

beforeEach(async () => {
  await syncPermissionCatalogue();
  ownerId = (await makeUser("Owner")).id;
  adminId = (await makeUser("Limited Admin")).id;
});

describe("createRole", () => {
  it("creates a role with the permissions it was given", async () => {
    const role = await RoleService.createRole(
      input({
        permissionCodes: [
          PERMISSIONS.EXPENSE_READ,
          PERMISSIONS.EXPENSE_READ_ALL,
        ],
      }),
      owner(),
    );

    expect(role.name).toBe("Accountant");
    expect(role.rolePermissions).toHaveLength(2);
  });

  it("refuses a duplicate name regardless of case", async () => {
    await RoleService.createRole(input(), owner());

    await expect(
      RoleService.createRole(input({ name: "accountant" }), owner()),
    ).rejects.toThrow(/already exists/i);
  });

  // Otherwise role.update is a way to mint unlimited access for yourself.
  it("refuses to grant a permission the actor does not hold", async () => {
    await expect(
      RoleService.createRole(
        input({ permissionCodes: [PERMISSIONS.USER_DELETE] }),
        limitedAdmin([PERMISSIONS.EXPENSE_READ]),
      ),
    ).rejects.toThrow(/cannot grant permissions you do not hold/i);
  });

  it("lets a non-owner grant permissions it does hold", async () => {
    const role = await RoleService.createRole(
      input({ permissionCodes: [PERMISSIONS.EXPENSE_READ] }),
      limitedAdmin([PERMISSIONS.EXPENSE_READ]),
    );

    expect(role.rolePermissions).toHaveLength(1);
  });
});

describe("updateRole", () => {
  it("replaces permissions rather than accumulating them", async () => {
    const role = await RoleService.createRole(
      input({
        permissionCodes: [PERMISSIONS.EXPENSE_READ, PERMISSIONS.EXPENSE_CREATE],
      }),
      owner(),
    );

    const updated = await RoleService.updateRole(
      role.id,
      input({ permissionCodes: [PERMISSIONS.STOCK_READ] }),
      owner(),
    );

    expect(updated.rolePermissions).toHaveLength(1);
    expect(updated.rolePermissions[0].permission.code).toBe(
      PERMISSIONS.STOCK_READ,
    );
  });

  it("can revoke every permission", async () => {
    const role = await RoleService.createRole(
      input({ permissionCodes: [PERMISSIONS.EXPENSE_READ] }),
      owner(),
    );

    const updated = await RoleService.updateRole(
      role.id,
      input({ permissionCodes: [] }),
      owner(),
    );

    expect(updated.rolePermissions).toHaveLength(0);
  });

  // The system role is the way back in after a misconfiguration.
  it("refuses to modify a system role, even for an owner", async () => {
    const system = await prisma.role.create({
      data: { name: "SYSTEM_OWNER", isSystem: true },
    });

    await expect(
      RoleService.updateRole(system.id, input({ name: "Renamed" }), owner()),
    ).rejects.toThrow(/system role/i);
  });
});

describe("deleteRole", () => {
  it("deletes an unassigned role", async () => {
    const role = await RoleService.createRole(input(), owner());

    await RoleService.deleteRole(role.id, owner());

    expect(await prisma.role.findUnique({ where: { id: role.id } })).toBeNull();
  });

  // UserRole cascades on roleId, so an unguarded delete would silently strip
  // the role from its holders and could leave a user with none at all.
  it("refuses while users still hold it", async () => {
    const role = await RoleService.createRole(input(), owner());
    const user = await prisma.user.create({
      data: { username: "holder", password: "x", name: "Holder" },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    await expect(RoleService.deleteRole(role.id, owner())).rejects.toThrow(
      /assigned to 1 user/i,
    );

    expect(
      await prisma.role.findUnique({ where: { id: role.id } }),
    ).not.toBeNull();
  });

  it("refuses to delete a system role", async () => {
    const system = await prisma.role.create({
      data: { name: "SYSTEM_OWNER", isSystem: true },
    });

    await expect(RoleService.deleteRole(system.id, owner())).rejects.toThrow(
      /system role/i,
    );
  });
});

describe("getRoles", () => {
  it("reports how many users hold each role", async () => {
    const role = await RoleService.createRole(input(), owner());
    const user = await prisma.user.create({
      data: { username: "counted", password: "x", name: "Counted" },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    const { data } = await RoleService.getRoles({ page: 1, limit: 20 });
    const found = data.find((r) => r.id === role.id)!;

    expect(found._count.userRoles).toBe(1);
  });

  it("lists system roles first", async () => {
    await RoleService.createRole(input({ name: "AAA First Alphabetically" }), owner());
    await prisma.role.create({ data: { name: "ZZZ System", isSystem: true } });

    const { data } = await RoleService.getRoles({ page: 1, limit: 20 });

    expect(data[0].isSystem).toBe(true);
  });
});

describe("getPermissionCatalogue", () => {
  it("groups every permission under a module", () => {
    const catalogue = RoleService.getPermissionCatalogue();
    const codes = catalogue.flatMap((group) =>
      group.permissions.map((p) => p.code),
    );

    expect(codes.sort()).toEqual(Object.values(PERMISSIONS).sort());
    expect(catalogue.every((group) => group.permissions.length > 0)).toBe(true);
  });
});
