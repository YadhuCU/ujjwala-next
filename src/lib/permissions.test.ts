import { describe, expect, it } from "vitest";
import {
  PERMISSION_MODULES,
  PERMISSION_REGISTRY,
  PERMISSIONS,
  SCOPES,
} from "./permissions";

describe("permission registry", () => {
  // The role editor renders from the registry, so a code missing here would be
  // enforceable on a route but ungrantable from the UI — invisible and unfixable.
  it("covers every permission code exactly once", () => {
    const codes = Object.values(PERMISSIONS);
    const registered = PERMISSION_REGISTRY.map((entry) => entry.code);

    expect([...registered].sort()).toEqual([...codes].sort());
  });

  it("has no duplicate codes", () => {
    const registered = PERMISSION_REGISTRY.map((entry) => entry.code);

    expect(new Set(registered).size).toBe(registered.length);
  });

  it("gives every entry a module and a label", () => {
    for (const entry of PERMISSION_REGISTRY) {
      expect(entry.module, entry.code).toBeTruthy();
      expect(entry.label, entry.code).toBeTruthy();
    }
  });

  it("keeps codes lowercase and dotted, matching the DB column", () => {
    for (const code of Object.values(PERMISSIONS)) {
      expect(code).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
    }
  });

  it("lists modules in registry order without repeats", () => {
    expect(new Set(PERMISSION_MODULES).size).toBe(PERMISSION_MODULES.length);
    expect(PERMISSION_MODULES[0]).toBe(PERMISSION_REGISTRY[0].module);
  });
});

describe("scope pairs", () => {
  it("references registered permissions", () => {
    const codes = new Set<string>(Object.values(PERMISSIONS));

    for (const [name, pair] of Object.entries(SCOPES)) {
      expect(codes.has(pair.all), `${name}.all`).toBe(true);
      expect(codes.has(pair.own), `${name}.own`).toBe(true);
      expect(pair.all).not.toBe(pair.own);
    }
  });
});
