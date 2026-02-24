import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const stocks = await prisma.stock.findMany({
      where: { isDeleted: false },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(stocks);
  });
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();
      const stock = await prisma.stock.create({
        data: {
          batchNo: data.batchNo,
          productId: data.productId ? parseInt(data.productId) : null,
          invoiceNo: data.invoiceNo,
          quantity: data.quantity != null ? String(data.quantity) : null,
          productCost: data.productCost != null ? String(data.productCost) : null,
          salePrice: data.salePrice != null ? String(data.salePrice) : null,
        },
      });
      return NextResponse.json(stock, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create stock";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}
