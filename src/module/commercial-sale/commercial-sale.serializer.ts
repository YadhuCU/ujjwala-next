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
    returns: { include: { product: true } };
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

    // Cylinders collected from the customer while this invoice was written.
    // Not tied to a line: they came off the customer's overall holding.
    returns: sale.returns.map((row) => ({
      id: row.id,
      productId: row.productId,
      quantity: row.quantity,
      product: row.product ?? undefined,
    })),
  };
}

export function serializeCommercialSales(sales: CommercialSaleWithRelations[]) {
  return sales.map(serializeCommercialSale);
}

export type CommercialSaleResponse = ReturnType<typeof serializeCommercialSale>;
