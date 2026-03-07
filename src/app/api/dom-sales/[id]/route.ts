import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const domSale = await prisma.domSale.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            stock: true,
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!domSale) {
      return NextResponse.json({ error: "Domestic Sale not found" }, { status: 404 });
    }

    return NextResponse.json(domSale);
  });
}

// NOTE: DomSales are strict and directly modify stock.
// Thus, editing quantities is complex and normally discouraged in simple accounting flows.
// For this rewrite, we only allow updating the header notes and metadata.
// If they need to change items, they should delete and recreate the Dom Sale.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const data = await request.json();

    const domSaleId = parseInt(id);

    // Update allowed fields
    const updatedSale = await prisma.domSale.update({
      where: { id: domSaleId },
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const domSaleId = parseInt(id);

    const domSale = await prisma.domSale.findUnique({
      where: { id: domSaleId },
      include: { items: true },
    });

    if (!domSale) {
      return NextResponse.json({ error: "Domestic Sale not found" }, { status: 404 });
    }

    if (domSale.isDeleted) {
      return NextResponse.json({ error: "Already deleted" }, { status: 400 });
    }

    // Soft delete headers and items, and refund the stock
    await prisma.$transaction(async (tx) => {
      // 1. Soft delete the header
      await tx.domSale.update({
        where: { id: domSaleId },
        data: { isDeleted: true },
      });

      // 2. Refund stock for every item
      for (const item of domSale.items) {
        if (item.stockId) {
          const stock = await tx.stock.findUnique({
            where: { id: item.stockId },
          });

          if (stock) {
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: stock.quantity + item.quantity },
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  }, "Owner");
}
