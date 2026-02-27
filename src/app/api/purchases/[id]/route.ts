import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(id) },
      include: {
        vendor: true,
        items: { include: { product: true } },
      },
    });
    if (!purchase) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(purchase);
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const data = await request.json();
      const purchase = await prisma.purchase.update({
        where: { id: parseInt(id) },
        data: {
          invoiceNo: data.invoiceNo || null,
          vendorId: data.vendorId ? parseInt(data.vendorId) : undefined,
          totalAmount:
            data.totalAmount != null ? Number(data.totalAmount) : undefined,
          purchaseDate: data.purchaseDate
            ? new Date(data.purchaseDate)
            : undefined,
          notes: data.notes !== undefined ? data.notes || null : undefined,
        },
      });
      return NextResponse.json(purchase);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const purchaseId = parseInt(id);

    // Fetch the purchase along with its items and the connected stock entries
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // Check if any of the stock connected to this purchase has been consumed.
    // We check this by comparing the original PurchaseItem quantity to the current Stock quantity.
    const linkedStocks = await prisma.stock.findMany({
      where: { purchaseId: purchaseId, isDeleted: false },
    });

    for (const item of purchase.items) {
      const relatedStock = linkedStocks.find(
        (s) => s.productId === item.productId && s.batchNo === item.batchNo && s.productCost === item.unitCost
      );
      
      // If the stock's current quantity is strictly less than what was purchased,
      // it means some of it was sold/rented out. 
      if (relatedStock && relatedStock.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Cannot delete purchase. Stock for product batch '${item.batchNo}' has already been consumed.` },
          { status: 400 }
        );
      }
    }

    // If safe, soft-delete the Purchase and all generated Stock.
    await prisma.$transaction([
      prisma.purchase.update({
        where: { id: purchaseId },
        data: { isDeleted: true },
      }),
      prisma.stock.updateMany({
        where: { purchaseId: purchaseId },
        data: { isDeleted: true },
      }),
    ]);

    return NextResponse.json({ success: true });
  }, "Owner");
}
