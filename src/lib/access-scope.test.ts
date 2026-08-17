import { describe, expect, it } from "vitest";
import {
  assertCanAccessRecord,
  resolveScope,
  scopeFilter,
  scopedWhere,
  type Actor,
} from "./access-scope";
import { ForbiddenError } from "./errors";
import { PERMISSIONS, SCOPES } from "./permissions";

const actor = (permissions: string[], isOwner = false): Actor => ({
  userId: 7,
  permissions: permissions as Actor["permissions"],
  isOwner,
});

describe("resolveScope", () => {
  it("returns all when the .all permission is held", () => {
    expect(
      resolveScope(actor([PERMISSIONS.EXPENSE_READ_ALL]), SCOPES.EXPENSE),
    ).toBe("all");
  });

  it("returns own when only the .own permission is held", () => {
    expect(
      resolveScope(actor([PERMISSIONS.EXPENSE_READ_OWN]), SCOPES.EXPENSE),
    ).toBe("own");
  });

  it("prefers all when both are held", () => {
    expect(
      resolveScope(
        actor([PERMISSIONS.EXPENSE_READ_OWN, PERMISSIONS.EXPENSE_READ_ALL]),
        SCOPES.EXPENSE,
      ),
    ).toBe("all");
  });

  it("returns none when neither is held", () => {
    expect(resolveScope(actor([PERMISSIONS.EXPENSE_READ]), SCOPES.EXPENSE)).toBe(
      "none",
    );
  });

  // A system role must not be lockable out by an edit to its permission rows.
  it("returns all for a system role regardless of permissions", () => {
    expect(resolveScope(actor([], true), SCOPES.EXPENSE)).toBe("all");
  });

  it("treats each module's pair independently", () => {
    const a = actor([PERMISSIONS.EXPENSE_READ_ALL, PERMISSIONS.REPORT_READ_OWN]);

    expect(resolveScope(a, SCOPES.EXPENSE)).toBe("all");
    expect(resolveScope(a, SCOPES.REPORT)).toBe("own");
    expect(resolveScope(a, SCOPES.DASHBOARD)).toBe("none");
  });
});

describe("scopeFilter", () => {
  it("does not constrain an all scope", () => {
    expect(scopeFilter(actor([]), "all")).toEqual({});
  });

  it("constrains an own scope to the acting user", () => {
    expect(scopeFilter(actor([]), "own")).toEqual({ createdById: 7 });
  });

  // Returning a filter that matches nothing would show a convincing empty list
  // rather than telling the user they lack access.
  it("throws on none rather than returning an impossible filter", () => {
    expect(() => scopeFilter(actor([]), "none")).toThrow(ForbiddenError);
  });
});

describe("scopedWhere", () => {
  it("resolves and filters in one step", () => {
    expect(
      scopedWhere(actor([PERMISSIONS.EXPENSE_READ_OWN]), SCOPES.EXPENSE),
    ).toEqual({ createdById: 7 });

    expect(
      scopedWhere(actor([PERMISSIONS.EXPENSE_READ_ALL]), SCOPES.EXPENSE),
    ).toEqual({});
  });

  it("throws when the actor has no scope for the module", () => {
    expect(() => scopedWhere(actor([]), SCOPES.EXPENSE)).toThrow(ForbiddenError);
  });
});

describe("assertCanAccessRecord", () => {
  it("allows any record under an all scope", () => {
    expect(() =>
      assertCanAccessRecord(actor([]), "all", { createdById: 99 }),
    ).not.toThrow();
  });

  it("allows an own record under an own scope", () => {
    expect(() =>
      assertCanAccessRecord(actor([]), "own", { createdById: 7 }),
    ).not.toThrow();
  });

  it("refuses someone else's record under an own scope", () => {
    expect(() =>
      assertCanAccessRecord(actor([]), "own", { createdById: 99 }),
    ).toThrow(ForbiddenError);
  });

  // Legacy rows predate the audit columns; nobody owns them.
  it("refuses an unowned record under an own scope", () => {
    expect(() =>
      assertCanAccessRecord(actor([]), "own", { createdById: null }),
    ).toThrow(ForbiddenError);
  });

  it("refuses everything under a none scope", () => {
    expect(() =>
      assertCanAccessRecord(actor([]), "none", { createdById: 7 }),
    ).toThrow(ForbiddenError);
  });
});
