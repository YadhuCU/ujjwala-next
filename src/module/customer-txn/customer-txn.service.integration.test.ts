import { beforeEach, describe, expect, it } from "vitest";
import { LedgerEntryType, PaymentType, ProductType } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  assertBalanceMatchesLedger,
  balanceOf,
  makeProduct,
  makeUser,
} from "@/test/factories";
import * as CustomerService from "@/module/customer/customer.service";
import * as CustomerTxnService from "./customer-txn.service";

let userId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
});

function customerInput(initialPendingAmount = 0, balances: {
  productId: number;
  qty: number;
}[] = []) {
  return {
    name: "Hotel Blue",
    phone: undefined,
    address: undefined,
    locationId: undefined,
    discount: undefined,
    concernedPerson: undefined,
    concernedPersonMobile: undefined,
    gstNumber: undefined,
    initialPendingAmount,
    initialCylinderBalances: balances,
  };
}

describe("customer creation", () => {
  // The bug this pins: a customer opening at zero used to get no balance row,
  // and every later payment against them failed.
  it("always creates a balance row, even at zero", async () => {
    const customer = await CustomerService.createCustomer(
      customerInput(0),
      userId,
    );

    const balance = await prisma.customerBalance.findUnique({
      where: { customerId: customer.id },
    });

    expect(balance).not.toBeNull();
    expect(Number(balance!.pendingAmount)).toBe(0);
  });

  it("writes an OPENING ledger row when the customer starts in debt", async () => {
    const customer = await CustomerService.createCustomer(
      customerInput(1500.5),
      userId,
    );

    const ledger = await prisma.customerPaymentLedger.findMany({
      where: { customerId: customer.id },
    });

    expect(ledger).toHaveLength(1);
    expect(ledger[0].entryType).toBe(LedgerEntryType.OPENING);
    expect(Number(ledger[0].amount)).toBe(1500.5);
    expect(await balanceOf(customer.id)).toBe(1500.5);
  });

  it("seeds opening cylinder custody per product", async () => {
    const product = await makeProduct(ProductType.COMMERCIAL);

    const customer = await CustomerService.createCustomer(
      customerInput(0, [{ productId: product.id, qty: 7 }]),
      userId,
    );

    const ledger = await prisma.customerCylinderLedger.findUniqueOrThrow({
      where: {
        productId_customerId: { productId: product.id, customerId: customer.id },
      },
    });
    expect(ledger.pendingCylinder).toBe(7);

    const initial = await prisma.customerInitialCylinderBalance.findUniqueOrThrow(
      {
        where: {
          customerId_productId: {
            customerId: customer.id,
            productId: product.id,
          },
        },
      },
    );
    expect(initial.qty).toBe(7);
  });
});

describe("recordPayment", () => {
  it("appends a negative PAYMENT row and reduces the balance", async () => {
    const customer = await CustomerService.createCustomer(
      customerInput(1000),
      userId,
    );

    await CustomerTxnService.recordPayment(
      customer.id,
      { amount: 400, paymentMethod: PaymentType.CASH, notes: "cash in hand" },
      userId,
    );

    expect(await balanceOf(customer.id)).toBe(600);

    const payment = await prisma.customerPaymentLedger.findFirstOrThrow({
      where: { customerId: customer.id, entryType: LedgerEntryType.PAYMENT },
    });
    expect(Number(payment.amount)).toBe(-400);

    const [cached, summed] = await assertBalanceMatchesLedger(customer.id);
    expect(cached).toBe(summed);
  });
});

describe("reversePayment", () => {
  it("puts the money back with an ADJUSTMENT instead of deleting", async () => {
    const customer = await CustomerService.createCustomer(
      customerInput(1000),
      userId,
    );

    const { ledgerEntry } = await CustomerTxnService.recordPayment(
      customer.id,
      { amount: 400, paymentMethod: PaymentType.CASH, notes: undefined },
      userId,
    );

    await CustomerTxnService.reversePayment(
      customer.id,
      ledgerEntry.id,
      userId,
    );

    expect(await balanceOf(customer.id)).toBe(1000);

    // The original payment is still on the ledger — nothing is ever deleted
    const rows = await prisma.customerPaymentLedger.findMany({
      where: { customerId: customer.id },
      orderBy: { id: "asc" },
    });
    expect(rows.map((r) => r.entryType)).toEqual([
      LedgerEntryType.OPENING,
      LedgerEntryType.PAYMENT,
      LedgerEntryType.ADJUSTMENT,
    ]);

    const [cached, summed] = await assertBalanceMatchesLedger(customer.id);
    expect(cached).toBe(summed);
  });

  it("links the reversal to the payment it undoes", async () => {
    const customer = await CustomerService.createCustomer(
      customerInput(1000),
      userId,
    );

    const { ledgerEntry: payment } = await CustomerTxnService.recordPayment(
      customer.id,
      { amount: 400, paymentMethod: PaymentType.CASH, notes: undefined },
      userId,
    );

    const { ledgerEntry: reversal } = await CustomerTxnService.reversePayment(
      customer.id,
      payment.id,
      userId,
    );

    expect(reversal.voidedEntryId).toBe(payment.id);
  });

  // voidedEntryId is @unique, so a second reversal cannot exist even if the
  // guard were bypassed.
  it("refuses to reverse the same payment twice", async () => {
    const customer = await CustomerService.createCustomer(
      customerInput(1000),
      userId,
    );

    const { ledgerEntry } = await CustomerTxnService.recordPayment(
      customer.id,
      { amount: 400, paymentMethod: PaymentType.CASH, notes: undefined },
      userId,
    );

    await CustomerTxnService.reversePayment(customer.id, ledgerEntry.id, userId);

    await expect(
      CustomerTxnService.reversePayment(customer.id, ledgerEntry.id, userId),
    ).rejects.toThrow(/already reversed/);

    expect(await balanceOf(customer.id)).toBe(1000);
  });

  it("refuses to reverse a payment belonging to someone else", async () => {
    const mine = await CustomerService.createCustomer(customerInput(500), userId);
    const theirs = await CustomerService.createCustomer(
      { ...customerInput(500), name: "Other" },
      userId,
    );

    const { ledgerEntry } = await CustomerTxnService.recordPayment(
      mine.id,
      { amount: 100, paymentMethod: PaymentType.CASH, notes: undefined },
      userId,
    );

    await expect(
      CustomerTxnService.reversePayment(theirs.id, ledgerEntry.id, userId),
    ).rejects.toThrow(/not found/);
  });
});

describe("customer deletion", () => {
  it("refuses while money is outstanding", async () => {
    const customer = await CustomerService.createCustomer(
      customerInput(250),
      userId,
    );

    await expect(CustomerService.deleteCustomer(customer.id)).rejects.toThrow(
      /outstanding balance or cylinders/,
    );
  });

  it("refuses while cylinders are still out", async () => {
    const product = await makeProduct(ProductType.COMMERCIAL);
    const customer = await CustomerService.createCustomer(
      customerInput(0, [{ productId: product.id, qty: 2 }]),
      userId,
    );

    await expect(CustomerService.deleteCustomer(customer.id)).rejects.toThrow(
      /outstanding balance or cylinders/,
    );
  });

  it("allows deletion once the customer is settled", async () => {
    const customer = await CustomerService.createCustomer(
      customerInput(0),
      userId,
    );

    const deleted = await CustomerService.deleteCustomer(customer.id);
    expect(deleted.isDeleted).toBe(true);
  });
});
