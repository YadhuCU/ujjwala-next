import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { generateTrNo } from "@/lib/generate-tr-no";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const where = {
      isDeleted: false,
      ...(search && {
        OR: [
          { trNo: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [total, arbSales] = await Promise.all([
      prisma.arbSale.count({ where }),
      prisma.arbSale.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      data: arbSales,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });
}

export async function POST(request: Request) {
  return withAuth(async ({ userId }) => {
    try {
      const data = await request.json();

      if (!data.items || data.items.length === 0) {
        return NextResponse.json(
          { error: "At least one item is required for Arb Sale" },
          { status: 400 }
        );
      }

      const trNo = await generateTrNo("arbSale");

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the ArbSale header
        const arbSale = await tx.arbSale.create({
          data: {
            trNo,
            totalAmount: data.totalAmount,
            customerId: data.customerId ? parseInt(data.customerId) : null,
            paymentType: data.paymentType || "cash",
            discount: data.discount ? Number(data.discount) : null,
            notes: data.notes,
            createdById: userId,
          },
        });

        // 2. Create items and adjust stock
        for (const item of data.items) {
          const quantity = Number(item.quantity) || 0;
          
          if (!item.stockId || quantity <= 0) {
            throw new Error(`Invalid stock or quantity for product ID ${item.productId}`);
          }

          // Fetch the stock to ensure it exists and has enough quantity
          const stock = await tx.stock.findUnique({
            where: { id: parseInt(item.stockId) },
            include: { product: true },
          });

          if (!stock) {
            throw new Error(`Stock ID ${item.stockId} not found`);
          }

          if (stock.quantity < quantity) {
            throw new Error(
              `Insufficient stock for batch ${stock.batchNo || "Unknown"} of ${stock.product?.name || "Unknown Product"}. Available: ${stock.quantity}`
            );
          }

          // Deduct from stock
          await tx.stock.update({
            where: { id: parseInt(item.stockId) },
            data: { quantity: stock.quantity - quantity },
          });

          // Create ArbSaleItem
          await tx.arbSaleItem.create({
            data: {
              arbSaleId: arbSale.id,
              stockId: parseInt(item.stockId),
              productId: stock.productId, // Pull securely from stock
              quantity: quantity,
              salePrice: item.salePrice,
              netTotal: item.netTotal,
            },
          });
        }

        return tx.arbSale.findUnique({
          where: { id: arbSale.id },
          include: {
            items: {
              include: { product: true },
            },
          },
        });
      });

      return NextResponse.json(result);
    } catch (error: unknown) {
      console.error("[ARB_SALE_POST]", error);
      const message = error instanceof Error ? error.message : "Failed to create arb sale";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner"); // Ensuring lower-case role matching if required, but default layout checks 'Owner'
}
