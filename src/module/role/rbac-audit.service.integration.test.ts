import { beforeEach, describe, expect, it } from "vitest";
import { RbacAuditAction } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { makeRole, makeUser, syncPermissionCatalogue } from "@/test/factories";
import * as RoleService from "./role.service";
import * as RbacAuditService from "./rbac-audit.service";
import * as UserService from "@/module/user/user.service";
import { diffCodes } from "./rbac-audit.service";

let actorId: number;

const actor = () => ({
  userId: actorId,
  permissions: [],
  isOwner: true,
  name: "The Owner",
});

const roleInput = (over: Record<string, unknown> = {}) => ({
  name: "Accountant",
  description: undefined,
  permissionCodes: [],
  ...over,
});

const query = { page: 1, limit: 50 };

beforeEach(async () => {
  await syncPermissionCatalogue();
  actorId = (await makeUser("The Owner")).id;
});

describe("diffCodes", () => {
  it("reports what was added and removed, sorted", () => {
    expect(diffCodes(["b", "c"], ["c", "a"])).toEqual({
      added: ["a"],
      removed: ["b"],
    });
  });

  it("reports nothing when the sets match", () => {
    expect(diffCodes(["a", "b"], ["b", "a"])).toEqual({
      added: [],
      removed: [],
    });
  });
});

describe("role changes are recorded", () => {
  it("records a creation with the permissions granted", async () => {
    await RoleService.createRole(
      roleInput({ permissionCodes: [PERMISSIONS.EXPENSE_READ] }),
      actor(),
    );

    const { data } = await RbacAuditService.getRbacAuditLog(query);

    expect(data).toHaveLength(1);
    expect(data[0].action).toBe(RbacAuditAction.ROLE_CREATED);
    expect(data[0].roleName).toBe("Accountant");
    expect(data[0].added).toEqual([PERMISSIONS.EXPENSE_READ]);
    expect(data[0].actorId).toBe(actorId);
  });

  it("records only the difference on an update", async () => {
    const role = await RoleService.createRole(
      roleInput({
        permissionCodes: [PERMISSIONS.EXPENSE_READ, PERMISSIONS.STOCK_READ],
      }),
      actor(),
    );

    await RoleService.updateRole(
      role.id,
      roleInput({
        permissionCodes: [PERMISSIONS.EXPENSE_READ, PERMISSIONS.PRODUCT_READ],
      }),
      actor(),
    );

    const { data } = await RbacAuditService.getRbacAuditLog(query);
    const update = data.find((e) => e.action === RbacAuditAction.ROLE_UPDATED)!;

    // expense.read was held before and after, so it is not part of the change.
    expect(update.added).toEqual([PERMISSIONS.PRODUCT_READ]);
    expect(update.removed).toEqual([PERMISSIONS.STOCK_READ]);
  });

  // The entry has to outlive the thing it describes, or it cannot answer
  // "who deleted the role that used to grant purchases".
  it("survives the deletion of the role it describes", async () => {
    const role = await RoleService.createRole(
      roleInput({ permissionCodes: [PERMISSIONS.PURCHASE_READ] }),
      actor(),
    );

    await RoleService.deleteRole(role.id, actor());

    expect(await prisma.role.findUnique({ where: { id: role.id } })).toBeNull();

    const { data } = await RbacAuditService.getRbacAuditLog(query);
    const deletion = data.find((e) => e.action === RbacAuditAction.ROLE_DELETED)!;

    expect(deletion.roleName).toBe("Accountant");
    expect(deletion.removed).toEqual([PERMISSIONS.PURCHASE_READ]);
  });

  it("keeps the actor's name after their account is deleted", async () => {
    await RoleService.createRole(roleInput(), actor());

    await prisma.user.delete({ where: { id: actorId } });

    const { data } = await RbacAuditService.getRbacAuditLog(query);

    // The FK is SetNull, so the row stays and the captured name carries it.
    expect(data[0].actorId).toBeNull();
    expect(data[0].actorName).toBe("The Owner");
  });
});

describe("user role assignments are recorded", () => {
  it("records which roles a user gained and lost", async () => {
    const before = await makeRole("BEFORE");
    const after = await makeRole("AFTER");
    const target = await makeUser("Target User");
    await prisma.userRole.create({
      data: { userId: target.id, roleId: before.id },
    });

    await UserService.updateUser(
      target.id,
      {
        name: "Target User",
        password: undefined,
        email: undefined,
        mobile: undefined,
        userRoles: [after.id],
      },
      { userId: actorId, isOwner: true, name: "The Owner" },
    );

    const { data } = await RbacAuditService.getRbacAuditLog(query);
    const entry = data.find(
      (e) => e.action === RbacAuditAction.USER_ROLES_CHANGED,
    )!;

    expect(entry.targetUserId).toBe(target.id);
    expect(entry.targetUserName).toBe("Target User");
    expect(entry.added).toEqual(["AFTER"]);
    expect(entry.removed).toEqual(["BEFORE"]);
  });

  // Saving the form without touching the roles should not fill the log with noise.
  it("records nothing when the roles are unchanged", async () => {
    const role = await makeRole("UNCHANGED");
    const target = await makeUser("Same Roles");
    await prisma.userRole.create({
      data: { userId: target.id, roleId: role.id },
    });

    await UserService.updateUser(
      target.id,
      {
        name: "Renamed Only",
        password: undefined,
        email: undefined,
        mobile: undefined,
        userRoles: [role.id],
      },
      { userId: actorId, isOwner: true },
    );

    const { data } = await RbacAuditService.getRbacAuditLog(query);

    expect(
      data.filter((e) => e.action === RbacAuditAction.USER_ROLES_CHANGED),
    ).toHaveLength(0);
  });
});

describe("getRbacAuditLog", () => {
  it("returns newest first and filters by role", async () => {
    const first = await RoleService.createRole(roleInput({ name: "First" }), actor());
    await RoleService.createRole(roleInput({ name: "Second" }), actor());

    const all = await RbacAuditService.getRbacAuditLog(query);
    expect(all.data[0].roleName).toBe("Second");
    expect(all.meta.total).toBe(2);

    const filtered = await RbacAuditService.getRbacAuditLog({
      ...query,
      roleId: first.id,
    });
    expect(filtered.meta.total).toBe(1);
    expect(filtered.data[0].roleName).toBe("First");
  });
});
