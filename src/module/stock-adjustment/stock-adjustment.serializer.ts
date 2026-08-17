import { Prisma } from "@/generated/client";

export type StockAdjustmentWithRelations = Prisma.StockAdjustmentGetPayload<{
  include: {
    product: true;
    createdBy: { select: { id: true; name: true } };
  };
}>;

export function serializeStockAdjustment(
  adjustment: StockAdjustmentWithRelations,
) {
  return {
    ...adjustment,
    createdBy: adjustment.createdBy ?? undefined,
  };
}

export function serializeStockAdjustments(
  adjustments: StockAdjustmentWithRelations[],
) {
  return adjustments.map(serializeStockAdjustment);
}

export type StockAdjustmentResponse = ReturnType<
  typeof serializeStockAdjustment
>;
