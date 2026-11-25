import { describe, expect, it } from "vitest";
import { retiredName } from "./soft-delete";

describe("retiredName", () => {
  it("appends the id so the original name is free again", () => {
    expect(retiredName("Acme Traders", 12, 50)).toBe("Acme Traders (deleted #12)");
  });

  it("trims the name, never the suffix, to fit the column", () => {
    const name = "A".repeat(50);
    const retired = retiredName(name, 7, 50);
    expect(retired).toHaveLength(50);
    expect(retired.endsWith(" (deleted #7)")).toBe(true);
  });

  it("gives two deletions of the same name different results", () => {
    expect(retiredName("Acme", 1, 50)).not.toBe(retiredName("Acme", 2, 50));
  });
});
