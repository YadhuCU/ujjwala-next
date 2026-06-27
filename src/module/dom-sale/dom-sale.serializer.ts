import { Prisma } from "@/generated/client";

export type DomSaleWithRelations = Prisma.DomSaleGetPayload<{
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

export function serializeDomSale(sale: DomSaleWithRelations) {
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

      stockId: item.stockId,

      salePrice: item.salePrice?.toNumber(),

      netTotal: item.netTotal?.toNumber(),

      product: item.product ?? undefined,

      stock: item.stock ?? undefined,
    })),
  };
}

export function serializeDomSales(sales: DomSaleWithRelations[]) {
  return sales.map(serializeDomSale);
}

export type DomSaleResponse = ReturnType<typeof serializeDomSale>;
