import { prisma } from "@/lib/prisma";
import { NotFoundError, BadRequestError, ConflictError } from "@/lib/errors";
import type {
  RecordPaymentInput,
  TransactionQueryInput,
} from "./customer-txn.payload.schema";
import { LedgerEntryType, Prisma, RefType } from "@/generated/client";

// =============================================================================
// CONSTANTS
// =============================================================================

const ledgerInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

// =============================================================================
// GUARDS
// =============================================================================

async function assertCustomerExists(
  tx: Prisma.TransactionClient,
  customerId: number,
) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, isDeleted: false },
  });
  if (!customer) throw new NotFoundError(`Customer #${customerId} not found`);
  return customer;
}

// A payment can only be reversed once — `voidedEntryId` is @unique, so the
// database enforces it too; this check is what turns that into a clean 409.
async function assertPaymentReversible(
  tx: Prisma.TransactionClient,
  customerId: number,
  paymentId: number,
) {
  const payment = await tx.customerPaymentLedger.findFirst({
    where: {
      id: paymentId,
      customerId,
      entryType: LedgerEntryType.PAYMENT,
    },
    include: { voidedBy: { select: { id: true } } },
  });

  if (!payment)
    throw new NotFoundError(`Payment #${paymentId} not found for this customer`);

  if (payment.voidedBy.length > 0)
    throw new ConflictError(`Payment #${paymentId} is already reversed`);

  return payment;
}

// =============================================================================
// PURE HELPERS
// =============================================================================

function reversalNote(paymentId: number): string {
  return `Reversal — payment #${paymentId}`;
}

// =============================================================================
// SUMMARY — pending amount + pending cylinders
// The primary "where does this customer stand" endpoint.
// =============================================================================

export async function getCustomerSummary(customerId: number) {
  await assertCustomerExists(prisma, customerId);

  const [balance, cylinderLedgers] = await Promise.all([
    prisma.customerBalance.findUnique({ where: { customerId } }),
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

export type CustomerTxnSummaryResponse = Awaited<
  ReturnType<typeof getCustomerSummary>
>;

// =============================================================================
// LIST — paginated CustomerPaymentLedger history
// =============================================================================

export async function getCustomerTransactions(
  customerId: number,
  query: TransactionQueryInput,
) {
  await assertCustomerExists(prisma, customerId);

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
      include: ledgerInclude,
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
// A standalone payment — cash walked in, not tied to any one invoice.
// =============================================================================

export async function recordPayment(
  customerId: number,
  input: RecordPaymentInput,
  userId: number,
) {
  return prisma.$transaction(async (tx) => {
    await assertCustomerExists(tx, customerId);

    const balance = await tx.customerBalance.findUnique({
      where: { customerId },
    });

    if (!balance) throw new BadRequestError("Customer has no balance record");

    // 1. Append PAYMENT entry to the ledger (negative = reduces what is owed)
    const ledgerEntry = await tx.customerPaymentLedger.create({
      data: {
        customerId,
        entryType: LedgerEntryType.PAYMENT,
        amount: -input.amount,
        refType: RefType.MANUAL,
        refId: customerId, // self-reference for standalone payments
        notes: input.notes ?? null,
        createdById: userId,
      },
      include: ledgerInclude,
    });

    // 2. Decrement balance cache
    const updated = await tx.customerBalance.update({
      where: { customerId },
      data: { pendingAmount: { decrement: input.amount } },
    });

    return { ledgerEntry, pendingAmount: updated.pendingAmount };
  });
}

// =============================================================================
// REVERSE PAYMENT
// Payments are never deleted — an ADJUSTMENT row puts the money back.
// =============================================================================

export async function reversePayment(
  customerId: number,
  paymentId: number,
  userId: number,
) {
  return prisma.$transaction(async (tx) => {
    await assertCustomerExists(tx, customerId);

    const payment = await assertPaymentReversible(tx, customerId, paymentId);

    // Original PAYMENT rows are negative — the reversal is its exact opposite.
    const reversalAmount = -Number(payment.amount);

    const ledgerEntry = await tx.customerPaymentLedger.create({
      data: {
        customerId,
        entryType: LedgerEntryType.ADJUSTMENT,
        amount: reversalAmount,
        refType: payment.refType,
        refId: payment.refId,
        voidedEntryId: paymentId,
        notes: reversalNote(paymentId),
        createdById: userId,
      },
      include: ledgerInclude,
    });

    const updated = await tx.customerBalance.update({
      where: { customerId },
      data: { pendingAmount: { increment: reversalAmount } },
    });

    return { ledgerEntry, pendingAmount: updated.pendingAmount };
  });
}
