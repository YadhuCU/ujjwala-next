import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTrNo } from "@/lib/generate-tr-no";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async ({ userId, role }) => {
    const where: Record<string, unknown> = { isDeleted: false };
    if (role !== "Owner") where.createdById = userId;

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
      let productCost: number = Number(data.productCost) || 0;
      let salePrice: number = Number(data.salePrice) || 0;

      if (stockId) {
        const stock = await prisma.stock.findUnique({
          where: { id: stockId },
          include: { product: true },
        });
        if (stock) {
          productId = stock.productId;
          productCost = Number(stock.productCost) || productCost;
          salePrice = stock.product ? Number(stock.product.salePrice) || salePrice : salePrice;
        }
      }

      const quantity = Number(data.quantity) || 0;
      const discount = data.discount ?? 0;
      const price = salePrice * quantity;
      const discountAmount = (price * discount) / 100;
      const netTotal = Number((price - discountAmount).toFixed(2));
      const saleType = data.saleType;

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
          saleType,
          paymentType: data.paymentType || "cash",
        },
      });

      // Deduct stock quantity
      if (stockId) {
        const stock = await prisma.stock.findUnique({ where: { id: stockId } });
        if (stock) {
          const newQty = stock.quantity - quantity;
          await prisma.stock.update({
            where: { id: stockId },
            data: { quantity: Math.max(0, newQty) },
          });
        }
      }

      // Create rent transaction if applicable
      if (customerId && stockId) {
        const emptyReturn = Number(data.emptyReturn) || 0;
        await prisma.rentTransaction.create({
          data: {
            customerId,
            stockId,
            saleId: sale.id,
            filledOut: quantity,
            emptyIn: emptyReturn,
          },
        });

        const existingRent = await prisma.rentProduct.findFirst({
          where: { customerId, stockId, isDeleted: false },
        });
        const currentRentQty = existingRent?.quantity ?? 0;
        const newRentQty = currentRentQty + quantity - emptyReturn;

        if (existingRent) {
          await prisma.rentProduct.update({
            where: { id: existingRent.id },
            data: { quantity: newRentQty },
          });
        } else {
          await prisma.rentProduct.create({
            data: { customerId, stockId, quantity: newRentQty },
          });
        }
      }

      // Create collection if amount provided
      if (customerId && data.collection && saleType === "rent" && Number(data.collection) > 0) {
        const collTrNo = await generateTrNo("collection");
        await prisma.collection.create({
          data: {
            trNo: collTrNo,
            customerId,
            amount: Number(data.collection),
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
