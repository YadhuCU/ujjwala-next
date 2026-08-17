import { Prisma } from "@/generated/client";

export type LedgerEntryWithRelations = Prisma.CustomerPaymentLedgerGetPayload<{
  include: { createdBy: { select: { id: true; name: true } } };
}>;

export type CylinderLedgerWithRelations =
  Prisma.CustomerCylinderLedgerGetPayload<{ include: { product: true } }>;

export function serializeLedgerEntry(entry: LedgerEntryWithRelations) {
  return {
    ...entry,
    amount: entry.amount.toNumber(),
    notes: entry.notes ?? undefined,
    createdBy: entry.createdBy ?? undefined,
  };
}

export function serializeLedgerEntries(entries: LedgerEntryWithRelations[]) {
  return entries.map(serializeLedgerEntry);
}

export function serializeCustomerSummary(summary: {
  pendingAmount: Prisma.Decimal | number;
  pendingCylinders: CylinderLedgerWithRelations[];
  allCylinderLedgers: CylinderLedgerWithRelations[];
}) {
  return {
    ...summary,
    pendingAmount: Number(summary.pendingAmount),
  };
}

export type LedgerEntryResponse = ReturnType<typeof serializeLedgerEntry>;
export type CustomerSummaryResponse = ReturnType<
  typeof serializeCustomerSummary
>;
