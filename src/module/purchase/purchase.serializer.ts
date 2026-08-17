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
