import { Prisma } from "@/generated/client";

export type PurchaseWithRelations = Prisma.PurchaseGetPayload<{
  include: {
    vendor: true;
    items: {
      include: {
        product: true;
      };
    };
  };
}>;

export function serializePurchase(purchase: PurchaseWithRelations) {
  return {
    ...purchase,

    invoiceNo: purchase.invoiceNo ?? undefined,

    notes: purchase.notes ?? undefined,

    totalCost: purchase.totalCost.toNumber(),

    items: purchase.items.map((item) => ({
      ...item,

      unitCost: item.unitCost?.toNumber(),

      totalCost: item.totalCost?.toNumber(),

      product: item.product,
    })),
  };
}

export function serializePurchases(purchases: PurchaseWithRelations[]) {
  return purchases.map(serializePurchase);
}

export type PurchaseResponse = ReturnType<typeof serializePurchase>;

// ─── Detail ──────────────────────────────────────────────────────────────────
// The single-record read adds whether the batches have been sold from (which
// decides between the full edit and the price correction) and the history of
// price corrections.

export type PurchaseDetailWithRelations = PurchaseWithRelations &
  Prisma.PurchaseGetPayload<{
    include: {
      priceCorrections: {
        include: {
          product: true;
          createdBy: { select: { id: true; name: true } };
        };
      };
    };
  }> & { soldFrom: boolean };

export function serializePurchaseDetail(purchase: PurchaseDetailWithRelations) {
  return {
    ...serializePurchase(purchase),

    soldFrom: purchase.soldFrom,

    priceCorrections: purchase.priceCorrections.map((correction) => ({
      id: correction.id,
      productName: correction.product.name,
      batchNo: correction.batchNo,
      quantity: correction.quantity,
      oldUnitCost: correction.oldUnitCost?.toNumber(),
      newUnitCost: correction.newUnitCost.toNumber(),
      reason: correction.reason,
      createdBy: correction.createdBy?.name ?? undefined,
      createdAt: correction.createdAt,
    })),
  };
}

export type PurchaseDetailResponse = ReturnType<typeof serializePurchaseDetail>;
