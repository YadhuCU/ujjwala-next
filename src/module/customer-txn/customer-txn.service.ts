import { prisma } from "@/lib/prisma";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import type {
  RecordPaymentInput,
  TransactionQueryInput,
} from "./customer-txn.schema";
import { LedgerEntryType, RefType } from "@/generated/enums";

// =============================================================================
// GUARD
// =============================================================================

async function assertCustomerExists(customerId: number) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, isDeleted: false },
  });
  if (!customer) throw new NotFoundError(`Customer #${customerId} not found`);
  return customer;
}

// =============================================================================
// GET SUMMARY — pending amount + pending cylinders
// This is the primary "dashboard" endpoint for a customer's current standing.
// =============================================================================

export async function getCustomerSummary(customerId: number) {
  await assertCustomerExists(customerId);

  const [balance, cylinderLedgers] = await Promise.all([
    prisma.customerBalance.findUnique({
      where: { customerId },
    }),
    prisma.customerCylinderLedger.findMany({
      where: { customerId },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
    }),
  ]);

  return {
    pendingAmount: balance?.pendingAmount ?? 0,
    // Only surface products where cylinders are actually outstanding
    pendingCylinders: cylinderLedgers.filter((l) => l.pendingCylinder > 0),
    // Include zero-balance products separately for full visibility
    allCylinderLedgers: cylinderLedgers,
  };
}

export type CustomerTxnSummaryResponse = Awaited<ReturnType<typeof getCustomerSummary>>

// =============================================================================
// GET TRANSACTION HISTORY — paginated CustomerPaymentLedger
// =============================================================================

export async function getCustomerTransactions(
  customerId: number,
  query: TransactionQueryInput,
) {
  await assertCustomerExists(customerId);

  const { entryType, from, to, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    customerId,
    ...(entryType && { entryType }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.customerPaymentLedger.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.customerPaymentLedger.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// RECORD PAYMENT
// Standalone payment — not tied to a specific invoice.
// Appends a PAYMENT entry and decrements the balance cache.
// =============================================================================

export async function recordPayment(
  customerId: number,
  input: RecordPaymentInput,
  userId: number,
) {
  await assertCustomerExists(customerId);

  // Guard: don't allow a payment that would push balance below zero
  // (overpayment creates a credit — valid for some businesses, optional guard)
  const balance = await prisma.customerBalance.findUnique({
    where: { customerId },
  });

  if (!balance) throw new BadRequestError("Customer has no balance record");

  // Uncomment if overpayment should be blocked:
  // if (input.amount > Number(balance.pendingAmount)) {
  //   throw new ConflictError("Payment exceeds outstanding balance", {
  //     pendingAmount: Number(balance.pendingAmount),
  //     paymentAmount: input.amount,
  //   })
  // }

  return prisma.$transaction(async (tx) => {
    // 1. Append PAYMENT entry to ledger
    const ledgerEntry = await tx.customerPaymentLedger.create({
      data: {
        customerId,
        // entryType:     "PAYMENT",
        entryType: LedgerEntryType.PAYMENT,
        amount: -input.amount, // negative = reduces balance
        refType: RefType.MANUAL,
        refId: customerId, // self-reference for standalone payments
        notes: input.notes ?? null,
        createdById: userId,
      },
    });

    // 2. Decrement balance cache
    const updated = await tx.customerBalance.update({
      where: { customerId },
      data: { pendingAmount: { decrement: input.amount } },
    });

    return {
      ledgerEntry,
      pendingAmount: updated.pendingAmount,
    };
  });
}