import { describe, expect, it } from "vitest";
import { isRouteActive } from "./app-sidebar";

describe("isRouteActive", () => {
  it("matches the route itself", () => {
    expect(isRouteActive("/stock", "/stock")).toBe(true);
  });

  it("keeps a section highlighted on its child pages", () => {
    expect(isRouteActive("/stock/add", "/stock")).toBe(true);
    expect(isRouteActive("/stock/12/edit", "/stock")).toBe(true);
  });

  // The bug this replaced: a plain startsWith lit up "Stock" and
  // "Stock Adjustment" at the same time.
  it("does not match a sibling route that shares a prefix", () => {
    expect(isRouteActive("/stock-adjustments", "/stock")).toBe(false);
    expect(isRouteActive("/stock-adjustments/add", "/stock")).toBe(false);
    expect(isRouteActive("/customer-txn/4", "/customers")).toBe(false);
    expect(isRouteActive("/roles", "/role")).toBe(false);
  });

  // Dashboard is "/", which every path starts with.
  it("only matches the dashboard on the dashboard", () => {
    expect(isRouteActive("/", "/")).toBe(true);
    expect(isRouteActive("/stock", "/")).toBe(false);
    expect(isRouteActive("/reports/dom-sale", "/")).toBe(false);
  });

  it("distinguishes report siblings", () => {
    expect(isRouteActive("/reports/dom-sale", "/reports/dom-sale")).toBe(true);
    expect(isRouteActive("/reports/dom-sale", "/reports/arb-sale")).toBe(false);
    expect(isRouteActive("/reports/dom-sale", "/reports")).toBe(true);
  });
});
