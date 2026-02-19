import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTrNo } from "@/lib/generate-tr-no";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async ({ userId, role }) => {
    const where: Record<string, unknown> = { isDeleted: false };
    if (role === "staff") where.createdById = userId;

    const sales = await prisma.sale.findMany({
      where,
      include: { stock: true, customer: true, product: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sales);
  });
}

export async function POST(request: Request) {
  return withAuth(async ({ userId }) => {
    try {
      const data = await request.json();
      const trNo = data.trNo || (await generateTrNo("sale"));
      const stockId = data.stockId ? parseInt(data.stockId) : null;
      const customerId = data.customerId ? parseInt(data.customerId) : null;

      let productId = null;
      let productCost = data.productCost || "0";
      let salePrice = data.salePrice || "0";

      if (stockId) {
        const stock = await prisma.stock.findUnique({ where: { id: stockId } });
        if (stock) {
          productId = stock.productId;
          productCost = stock.productCost || productCost;
          salePrice = stock.salePrice || salePrice;
        }
      }

      const quantity = String(data.quantity || "0");
      const discount = data.discount ? parseInt(data.discount) : 0;
      const price = parseFloat(salePrice) * parseFloat(quantity);
      const discountAmount = (price * discount) / 100;
      const netTotal = (price - discountAmount).toFixed(2);

      const sale = await prisma.sale.create({
        data: {
          trNo,
          stockId,
          customerId,
          productId,
          isOffer: data.isOffer || false,
          discount,
          quantity,
          productCost,
          salePrice,
          netTotal,
          createdById: userId,
        },
      });

      // Deduct stock quantity
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

      // Create rent transaction if applicable
      if (customerId && stockId && data.saleType === "rent") {
        const emptyReturn = parseInt(data.emptyReturn || "0");
        await prisma.rentTransaction.create({
          data: {
            customerId,
            stockId,
            saleId: sale.id,
            filledOut: parseInt(quantity),
            emptyIn: emptyReturn,
          },
        });

        const existingRent = await prisma.rentProduct.findFirst({
          where: { customerId, stockId, isDeleted: false },
        });
        const currentRentQty = parseInt(existingRent?.quantity || "0");
        const newRentQty = currentRentQty + parseInt(quantity) - emptyReturn;

        if (existingRent) {
          await prisma.rentProduct.update({
            where: { id: existingRent.id },
            data: { quantity: String(newRentQty) },
          });
        } else {
          await prisma.rentProduct.create({
            data: { customerId, stockId, quantity: String(newRentQty) },
          });
        }
      }

      // Create collection if amount provided
      if (customerId && data.collection && parseFloat(data.collection) > 0) {
        const collTrNo = await generateTrNo("collection");
        await prisma.collection.create({
          data: {
            trNo: collTrNo,
            customerId,
            amount: String(data.collection),
            createdById: userId,
          },
        });
      }

      return NextResponse.json(sale, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create sale";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
