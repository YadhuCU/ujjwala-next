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

    const [total, domSales] = await Promise.all([
      prisma.domSale.count({ where }),
      prisma.domSale.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              stock: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      data: domSales,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });
}

export async function POST(request: Request) {
  return withAuth(async ({ userId }) => {
    try {
      const data = await request.json();

      // items may be empty for a collection-only invoice

      const trNo = await generateTrNo("dom_sale");

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the DomSale header
        const domSale = await tx.domSale.create({
          data: {
            trNo,
            totalAmount: data.totalAmount,
            paidAmount: data.paidAmount ? Number(data.paidAmount) : 0,
            customerId: data.customerId ? parseInt(data.customerId) : null,
            paymentType: data.paymentType || "cash",
            discount: data.discount ? Number(data.discount) : null,
            notes: data.notes,
            createdById: userId,
          },
        });
        
        // 1.5 Create Collection record if paidAmount provided
        if (data.customerId && data.paidAmount && Number(data.paidAmount) > 0) {
          const collTrNo = await generateTrNo("collection");
          await tx.collection.create({
            data: {
              trNo: collTrNo,
              customerId: parseInt(data.customerId),
              domSaleId: domSale.id,
              amount: Number(data.paidAmount),
              createdById: userId,
            },
          });
        }

        // 2. Create items and adjust stock (skipped for collection-only invoices)
        for (const item of (data.items || [])) {
          const quantity = Number(item.quantity) || 0;

          // Skip items with no stock or zero quantity (collection-only rows)
          if (!item.stockId || quantity <= 0) continue;

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

          // Create DomSaleItem
          await tx.domSaleItem.create({
            data: {
              domSaleId: domSale.id,
              stockId: parseInt(item.stockId),
              productId: stock.productId, // Pull securely from stock
              quantity: quantity,
              salePrice: item.salePrice,
              netTotal: item.netTotal,
            },
          });
        }

        return tx.domSale.findUnique({
          where: { id: domSale.id },
          include: {
            items: {
              include: { product: true, stock: true },
            },
          },
        });
      });

      return NextResponse.json(result);
    } catch (error: unknown) {
      console.error("[DOM_SALE_POST]", error);
      const message = error instanceof Error ? error.message : "Failed to create domestic sale";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}
