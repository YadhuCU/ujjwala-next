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
        OR: [{ trNo: { contains: search, mode: "insensitive" as const } }],
      }),
    };

    const [total, commercialSales] = await Promise.all([
      prisma.commercialSale.count({ where }),
      prisma.commercialSale.findMany({
        where,
        include: {
          customer: true,
          items: { include: { product: true, stock: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      data: commercialSales,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });
}

export async function POST(request: Request) {
  return withAuth(async ({ userId }) => {
    try {
      const data = await request.json();
      const trNo = await generateTrNo("commercialSale");

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create CommercialSale header
        const commercialSale = await tx.commercialSale.create({
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

        // 1.5. Create Collection record if paidAmount provided
        if (data.customerId && data.paidAmount && Number(data.paidAmount) > 0) {
          const collTrNo = await generateTrNo("collection");
          await tx.collection.create({
            data: {
              trNo: collTrNo,
              customerId: parseInt(data.customerId),
              commercialSaleId: commercialSale.id,
              amount: Number(data.paidAmount),
              createdById: userId,
            },
          });
        }

        // 2. Process each item
        for (const item of data.items || []) {
          const quantity = Number(item.quantity) || 0;
          // saleType is set at invoice header level; form propagates it to each item
          const saleType: "rent" | "sale" = item.saleType === "sale" ? "sale" : "rent";

          // Read cylinder fields early so we can use them in the skip check
          const cylindersDisp = saleType === "rent" ? (Number(item.cylindersDispatched) || 0) : 0;
          const cylindersRet  = saleType === "rent" ? (Number(item.cylindersReturned)  || 0) : 0;

          // Skip if no stock selected
          if (!item.stockId) continue;
          // Skip only if there's literally nothing to do (no billing AND no cylinder movement)
          if (quantity <= 0 && cylindersDisp <= 0 && cylindersRet <= 0) continue;

          const stock = await tx.stock.findUnique({
            where: { id: parseInt(item.stockId) },
            include: { product: true },
          });
          if (!stock) throw new Error(`Stock ID ${item.stockId} not found`);

          let cylindersDispatched = 0;
          let cylindersReturned = 0;

          if (saleType === "sale") {
            // ── Outright sale: deduct from stock inventory ───────────────────
            if (stock.quantity < quantity) {
              throw new Error(
                `Insufficient stock for ${stock.product?.name || "Unknown"} batch ${stock.batchNo || "Unknown"}. Available: ${stock.quantity}`
              );
            }
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: stock.quantity - quantity },
            });
          } else {
            // ── Rent item: update cylinder ledger ────────────────────────────
            // Already read above (cylindersDisp / cylindersRet) to support return-only entries
            cylindersDispatched = cylindersDisp;
            cylindersReturned = cylindersRet;

            // Only touch the ledger when a customer is linked
            if (data.customerId) {
              const customerId = parseInt(data.customerId);

              // Running ledger qty from RentProduct
              const rentProduct = await tx.rentProduct.findFirst({
                where: { customerId, stockId: stock.id },
              });
              const currentRentQty = rentProduct?.quantity ?? 0;

              // Opening balance from CustomerInitialCylinderBalance (by product)
              const initialBalance = stock.productId
                ? await tx.customerInitialCylinderBalance.findUnique({
                    where: { customerId_productId: { customerId, productId: stock.productId } },
                  })
                : null;
              const initialQty = initialBalance?.quantity ?? 0;

              // Total cylinders the customer currently holds
              const totalHeld = currentRentQty + initialQty;

              // Validate: cannot return more than what's held + what's being dispatched now
              if (cylindersReturned > totalHeld + cylindersDispatched) {
                throw new Error(
                  `Cannot return ${cylindersReturned} cylinders for ${stock.product?.name || "Unknown"} ` +
                    `— customer holds ${totalHeld} (ledger ${currentRentQty} + opening ${initialQty}) ` +
                    `+ ${cylindersDispatched} dispatched now = ${totalHeld + cylindersDispatched} total`
                );
              }

              // Net change on the running ledger (initial balance is immutable)
              const newQty = currentRentQty + cylindersDispatched - cylindersReturned;

              if (rentProduct) {
                await tx.rentProduct.update({
                  where: { id: rentProduct.id },
                  data: { quantity: newQty },
                });
              } else {
                await tx.rentProduct.create({
                  data: { customerId, stockId: stock.id, quantity: newQty },
                });
              }
            }
          }

          // Create CommercialSaleItem
          const createdItem = await tx.commercialSaleItem.create({
            data: {
              commercialSaleId: commercialSale.id,
              stockId: stock.id,
              productId: stock.productId,
              saleType,
              quantity,
              salePrice: item.salePrice,
              netTotal: item.netTotal,
              cylindersDispatched,
              cylindersReturned,
            },
          });

          // RentTransaction audit log — rent items with a linked customer only
          if (saleType === "rent" && data.customerId) {
            await tx.rentTransaction.create({
              data: {
                customerId: parseInt(data.customerId),
                stockId: stock.id,
                commercialSaleItemId: createdItem.id,
                filledOut: cylindersDispatched,
                emptyIn: cylindersReturned,
                saleId: null,
              },
            });
          }
        }

        return tx.commercialSale.findUnique({
          where: { id: commercialSale.id },
          include: { items: { include: { product: true, stock: true } } },
        });
      });

      return NextResponse.json(result);
    } catch (error: unknown) {
      console.error("[COMMERCIAL_SALE_POST]", error);
      const message =
        error instanceof Error ? error.message : "Failed to create commercial sale";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}
