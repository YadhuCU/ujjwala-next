import { Prisma } from "@/generated/client";

export type StockWithRelations = Prisma.StockGetPayload<{
  include: { product: true; vendor: true };
}>;

export function serializeStock(stock: StockWithRelations) {
  return {
    ...stock,

    invoiceNo: stock.invoiceNo ?? undefined,

    productId: stock.productId ?? undefined,

    productCost: stock.productCost?.toNumber(),

    product: stock.product ?? undefined,

    vendor: stock.vendor ?? undefined,

    /** Batches created by a purchase are read-only here — edit the purchase. */
    isManual: stock.purchaseId === null,
  };
}

export function serializeStocks(stocks: StockWithRelations[]) {
  return stocks.map(serializeStock);
}

export type StockResponse = ReturnType<typeof serializeStock>;
