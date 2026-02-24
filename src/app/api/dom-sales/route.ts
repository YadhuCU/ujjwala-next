import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTrNo } from "@/lib/generate-tr-no";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async ({ userId, role }) => {
    const where: Record<string, unknown> = { isDeleted: false };
    if (role !== "Owner") where.createdById = userId;

    const domSales = await prisma.domSale.findMany({
      where,
      include: { stock: true, product: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(domSales);
  });
}

export async function POST(request: Request) {
  return withAuth(async ({ userId }) => {
    try {
      const data = await request.json();
      const trNo = data.trNo || (await generateTrNo("dom_sale"));
      const stockId = data.stockId ? parseInt(data.stockId) : null;

      let productId = null;
      if (stockId) {
        const stock = await prisma.stock.findUnique({ where: { id: stockId } });
        if (stock) productId = stock.productId;
      }

      const quantity = String(data.quantity || "0");
      const salePrice = String(data.salePrice || "0");
      const collectionAmount = String(data.collectionAmount || "0");
      const netTotal = (parseFloat(salePrice) * parseFloat(quantity)).toFixed(2);

      const domSale = await prisma.domSale.create({
        data: { trNo, stockId, productId, quantity, salePrice, collectionAmount, netTotal, createdById: userId },
      });

      if (stockId) {
        const stock = await prisma.stock.findUnique({ where: { id: stockId } });
        if (stock) {
          const newQty = parseInt(stock.quantity || "0") - parseInt(quantity);
          await prisma.stock.update({
            where: { id: stockId },
            data: { quantity: String(Math.max(0, newQty)) },
          });
        }
      }

      return NextResponse.json(domSale, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create domestic sale";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
