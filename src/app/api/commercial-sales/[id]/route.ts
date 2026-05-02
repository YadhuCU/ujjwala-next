import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const commercialSale = await prisma.commercialSale.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        items: {
          include: {
            stock: true,
            product: true,
            rentTransactions: true,
          },
        },
        collections: true,
      },
    });

    if (!commercialSale) {
      return NextResponse.json({ error: "Commercial Sale not found" }, { status: 404 });
    }

    return NextResponse.json(commercialSale);
  });
}

/**
 * Only header fields are editable (notes, paymentType, discount).
 * Item editing requires delete + recreate to maintain ledger integrity.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const data = await request.json();

    const updatedSale = await prisma.commercialSale.update({
      where: { id: parseInt(id) },
      data: {
        totalAmount: data.totalAmount !== undefined ? data.totalAmount : undefined,
        customerId: data.customerId ? parseInt(data.customerId) : null,
        paymentType: data.paymentType,
        discount: data.discount !== undefined ? Number(data.discount) : undefined,
        notes: data.notes,
      },
    });

    return NextResponse.json(updatedSale);
  }, "Owner");
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const saleId = parseInt(id);

    const commercialSale = await prisma.commercialSale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!commercialSale) {
      return NextResponse.json({ error: "Commercial Sale not found" }, { status: 404 });
    }

    if (commercialSale.isDeleted) {
      return NextResponse.json({ error: "Already deleted" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Soft-delete header and its linked collection records
      await tx.commercialSale.update({
        where: { id: saleId },
        data: { isDeleted: true },
      });
      await tx.collection.updateMany({
        where: { commercialSaleId: saleId },
        data: { isDeleted: true },
      });

      for (const item of commercialSale.items) {
        if (item.saleType === "sale" && item.stockId) {
          // Refund stock for straight-sale items
          const stock = await tx.stock.findUnique({ where: { id: item.stockId } });
          if (stock) {
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: stock.quantity + item.quantity },
            });
          }
        } else if (item.saleType === "rent" && item.stockId && commercialSale.customerId) {
          // Reverse cylinder ledger for rent items:
          // net delta was (+dispatched − returned), so reversal is (−dispatched + returned)
          const rentProduct = await tx.rentProduct.findFirst({
            where: {
              customerId: commercialSale.customerId,
              stockId: item.stockId,
            },
          });
          if (rentProduct) {
            const reversedQty =
              rentProduct.quantity - item.cylindersDispatched + item.cylindersReturned;
            // Do NOT clamp at 0 — ledger can be negative relative to initial balance
            await tx.rentProduct.update({
              where: { id: rentProduct.id },
              data: { quantity: reversedQty },
            });
          }

          // Detach rent transactions from this sale item
          await tx.rentTransaction.updateMany({
            where: { commercialSaleItemId: item.id },
            data: { commercialSaleItemId: null },
          });
        }
      }
    });


    return NextResponse.json({ success: true });
  }, "Owner");
}
