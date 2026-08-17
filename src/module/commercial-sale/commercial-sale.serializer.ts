import { Prisma } from "@/generated/client";

export type CommercialSaleWithRelations = Prisma.CommercialSaleGetPayload<{
  include: {
    customer: true;
    items: {
      include: {
        product: true;
        stock: true;
      };
    };
  };
}>;

export function serializeCommercialSale(sale: CommercialSaleWithRelations) {
  return {
    ...sale,

    notes: sale.notes ?? undefined,

    discount: sale.discount?.toNumber(),

    totalAmount: sale.totalAmount?.toNumber() ?? 0,

    paidAmount: sale.paidAmount.toNumber(),

    customer: sale.customer ?? undefined,

    items: sale.items.map((item) => ({
      ...item,

      productId: item.productId ?? undefined,

      stockId: item.stockId ?? undefined,

      salePrice: item.salePrice?.toNumber(),

      netTotal: item.netTotal?.toNumber(),

      product: item.product ?? undefined,

      stock: item.stock ?? undefined,

      // Cylinders still with the customer for this line (RENT lines only)
      cylindersOutstanding: item.cylindersDispatched - item.cylindersReturned,
    })),
  };
}

export function serializeCommercialSales(sales: CommercialSaleWithRelations[]) {
  return sales.map(serializeCommercialSale);
}

export type CommercialSaleResponse = ReturnType<typeof serializeCommercialSale>;
