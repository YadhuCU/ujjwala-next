import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const data = await request.json();
      const stock = await prisma.stock.update({
        where: { id: parseInt(id) },
        data: {
          batchNo: data.batchNo,
          productId: data.productId ? parseInt(data.productId) : null,
          invoiceNo: data.invoiceNo,
          quantity: data.quantity != null ? String(data.quantity) : undefined,
          productCost: data.productCost != null ? String(data.productCost) : undefined,
          salePrice: data.salePrice != null ? String(data.salePrice) : undefined,
        },
      });
      return NextResponse.json(stock);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "admin");
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.stock.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  }, "admin");
}
