import { Prisma } from "@/generated/client";

export type ArbSaleWithRelations = Prisma.DomSaleGetPayload<{
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

export function serializeArbSale(sale: ArbSaleWithRelations) {
  return {
    ...sale,

    notes: sale.notes ?? undefined,

    discount: sale.discount?.toNumber(),

    totalAmount: sale.totalAmount.toNumber(),

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
    })),
  };
}

export function serializeArbSales(sales: ArbSaleWithRelations[]) {
  return sales.map(serializeArbSale);
}

export type ArbSaleResponse = ReturnType<typeof serializeArbSale>;
