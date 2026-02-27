import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const purchases = await prisma.purchase.findMany({
      where: { isDeleted: false },
      include: {
        vendor: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(purchases);
  });
}

interface PurchaseItemInput {
  productId: number;
  batchNo: string;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the purchase
        const purchase = await tx.purchase.create({
          data: {
            invoiceNo: data.invoiceNo || null,
            vendorId: parseInt(data.vendorId),
            totalAmount: data.totalAmount != null ? Number(data.totalAmount) : null,
            purchaseDate: data.purchaseDate
              ? new Date(data.purchaseDate)
              : new Date(),
            notes: data.notes || null,
          },
        });

        // 2. Create purchase items and stock entries
        const items: PurchaseItemInput[] = data.items || [];
        for (const item of items) {
          await tx.purchaseItem.create({
            data: {
              purchaseId: purchase.id,
              productId: Number(item.productId),
              batchNo: item.batchNo,
              quantity: Number(item.quantity) || 0,
              unitCost: item.unitCost != null ? Number(item.unitCost) : null,
              totalCost: item.totalCost != null ? Number(item.totalCost) : null,
            },
          });

          // 3. Auto-create a Stock entry for each item
          await tx.stock.create({
            data: {
              batchNo: item.batchNo,
              productId: Number(item.productId),
              invoiceNo: data.invoiceNo || null,
              quantity: Number(item.quantity) || 0,
              productCost: item.unitCost != null ? Number(item.unitCost) : null,
              vendorId: parseInt(data.vendorId),
              purchaseId: purchase.id,
            },
          });
        }

        return purchase;
      });

      return NextResponse.json(result, { status: 201 });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create purchase";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}
