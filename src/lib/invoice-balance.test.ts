import { describe, expect, it } from "vitest";
import { invoiceBalance } from "./invoice-balance";

describe("invoiceBalance", () => {
  it("leaves the unpaid part due on the invoice", () => {
    expect(invoiceBalance(1000, 400)).toEqual({ balance: 600, towardEarlierDue: 0 });
  });

  it("is settled when paid in full", () => {
    expect(invoiceBalance(1000, 1000)).toEqual({ balance: 0, towardEarlierDue: 0 });
  });

  it("puts a payment beyond the invoice toward earlier dues, never a negative balance", () => {
    expect(invoiceBalance(1000, 1500)).toEqual({ balance: 0, towardEarlierDue: 500 });
  });

  it("rounds to paise", () => {
    expect(invoiceBalance(100.1, 100.3)).toEqual({ balance: 0, towardEarlierDue: 0.2 });
  });
});
