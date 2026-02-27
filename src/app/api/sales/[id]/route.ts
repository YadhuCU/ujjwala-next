import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { generateTrNo } from "@/lib/generate-tr-no";

// ─── GET single sale (for edit form) ─────────────────────────────────────────

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const sale = await prisma.sale.findUnique({
      where: { id: parseInt(id) },
      include: {
        stock: true,
        customer: true,
        product: true,
        rentTransactions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    // Find collection linked to this sale (same customer, created at same time ±2s)
    let collection = null;
    if (sale.customerId) {
      collection = await prisma.collection.findFirst({
        where: {
          customerId: sale.customerId,
          isDeleted: false,
          createdAt: {
            gte: new Date(sale.createdAt.getTime() - 2000),
            lte: new Date(sale.createdAt.getTime() + 2000),
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // Determine sale type from rent transactions
    const isRent = sale.rentTransactions.length > 0;
    const rentTx = isRent ? sale.rentTransactions[0] : null;

    return NextResponse.json({
      ...sale,
      saleType: isRent ? "rent" : "sale",
      emptyReturn: rentTx?.emptyIn ?? 0,
      collectionAmount: collection ? Number(collection.amount) || 0 : 0,
      collectionId: collection?.id ?? null,
    });
  });
}

// ─── PUT — delta-based update ─────────────────────────────────────────────────

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async ({ userId }) => {
    try {
      const { id } = await params;
      const saleId = parseInt(id);
      const data = await request.json();

      // ── 1. Fetch the OLD sale with all relations ──────────────────────────
      const oldSale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { rentTransactions: true },
      });
      if (!oldSale) {
        return NextResponse.json({ error: "Sale not found" }, { status: 404 });
      }

      const oldStockId = oldSale.stockId;
      const oldCustomerId = oldSale.customerId;
      const oldQty = oldSale.quantity;
      const isRent = oldSale.rentTransactions.length > 0;
      const oldRentTx = isRent ? oldSale.rentTransactions[0] : null;
      const oldEmptyReturn = oldRentTx?.emptyIn ?? 0;

      // ── 2. Resolve new values ──────────────────────────────────────────────
      const newStockId = data.stockId ? parseInt(data.stockId) : null;
      const newCustomerId = data.customerId ? parseInt(data.customerId) : null;
      const newQty = Number(data.quantity) || 0;
      const newEmptyReturn = Number(data.emptyReturn) || 0;
      const newDiscount = data.discount ?? 0;

      // Fetch stock for prices
      let productId = oldSale.productId;
      let productCost: number = Number(oldSale.productCost) || 0;
      let salePrice: number = Number(oldSale.salePrice) || 0;

      if (newStockId) {
        const stock = await prisma.stock.findUnique({
          where: { id: newStockId },
          include: { product: true },
        });
        if (stock) {
          productId = stock.productId;
          productCost = Number(stock.productCost) || productCost;
          salePrice = stock.product ? Number(stock.product.salePrice) || salePrice : salePrice;
        }
      }

      // ── 3. Recalculate net total ──────────────────────────────────────────
      const price = salePrice * newQty;
      const discountAmount = (price * newDiscount) / 100;
      const netTotal = Number((price - discountAmount).toFixed(2));

      // ── 4. Stock delta adjustment ─────────────────────────────────────────
      const stockChanged = oldStockId !== newStockId;

      if (stockChanged) {
        // Restore old stock quantity
        if (oldStockId) {
          const oldStock = await prisma.stock.findUnique({ where: { id: oldStockId } });
          if (oldStock) {
            const restoredQty = oldStock.quantity + oldQty;
            await prisma.stock.update({
              where: { id: oldStockId },
              data: { quantity: restoredQty },
            });
          }
        }
        // Deduct from new stock
        if (newStockId) {
          const newStock = await prisma.stock.findUnique({ where: { id: newStockId } });
          if (newStock) {
            const availableQty = newStock.quantity;
            if (newQty > availableQty) {
              return NextResponse.json(
                { error: `Insufficient stock. Available: ${availableQty}` },
                { status: 400 }
              );
            }
            await prisma.stock.update({
              where: { id: newStockId },
              data: { quantity: availableQty - newQty },
            });
          }
        }
      } else if (oldStockId && newQty !== oldQty) {
        // Same stock, quantity changed — apply delta
        const stock = await prisma.stock.findUnique({ where: { id: oldStockId } });
        if (stock) {
          const currentStockQty = stock.quantity;
          const delta = oldQty - newQty; // positive = qty decreased → stock increases
          const newStockQty = currentStockQty + delta;
          if (newStockQty < 0) {
            return NextResponse.json(
              { error: `Insufficient stock. Available: ${currentStockQty + oldQty}` },
              { status: 400 }
            );
          }
          await prisma.stock.update({
            where: { id: oldStockId },
            data: { quantity: newStockQty },
          });
        }
      }

      // ── 5. Rent transaction adjustment (only for rent-type sales) ─────────
      if (isRent && oldRentTx) {
        const customerChanged = oldCustomerId !== newCustomerId;

        if (customerChanged) {
          // Reverse old customer's RentProduct
          if (oldCustomerId && oldStockId) {
            const oldRentProduct = await prisma.rentProduct.findFirst({
              where: { customerId: oldCustomerId, stockId: oldStockId, isDeleted: false },
            });
            if (oldRentProduct) {
              const oldRentQty = oldRentProduct.quantity;
              const reversedQty = oldRentQty - oldQty + oldEmptyReturn;
              await prisma.rentProduct.update({
                where: { id: oldRentProduct.id },
                data: { quantity: Math.max(0, reversedQty) },
              });
            }
          }

          // Create/update new customer's RentProduct
          const effectiveStockId = newStockId || oldStockId;
          if (newCustomerId && effectiveStockId) {
            const newRentProduct = await prisma.rentProduct.findFirst({
              where: { customerId: newCustomerId, stockId: effectiveStockId, isDeleted: false },
            });
            const newRentQty = newQty - newEmptyReturn;
            if (newRentProduct) {
              const existingQty = newRentProduct.quantity;
              await prisma.rentProduct.update({
                where: { id: newRentProduct.id },
                data: { quantity: existingQty + newRentQty },
              });
            } else {
              await prisma.rentProduct.create({
                data: {
                  customerId: newCustomerId,
                  stockId: effectiveStockId,
                  quantity: newRentQty,
                },
              });
            }
          }

          // Update the rent transaction
          await prisma.rentTransaction.update({
            where: { id: oldRentTx.id },
            data: {
              customerId: newCustomerId!,
              stockId: newStockId || oldStockId!,
              filledOut: newQty,
              emptyIn: newEmptyReturn,
            },
          });
        } else {
          // Same customer — delta adjustment on RentProduct
          const effectiveStockId = newStockId || oldStockId;
          const qtyDelta = newQty - oldQty;
          const emptyDelta = newEmptyReturn - oldEmptyReturn;
          const rentProductDelta = qtyDelta - emptyDelta; // net change in cylinders held

          if ((rentProductDelta !== 0 || stockChanged) && oldCustomerId && effectiveStockId) {
            if (stockChanged && oldStockId) {
              // Reverse from old stock's RentProduct
              const oldRP = await prisma.rentProduct.findFirst({
                where: { customerId: oldCustomerId, stockId: oldStockId, isDeleted: false },
              });
              if (oldRP) {
                const oldRPQty = oldRP.quantity;
                const reversedQty = oldRPQty - oldQty + oldEmptyReturn;
                await prisma.rentProduct.update({
                  where: { id: oldRP.id },
                  data: { quantity: Math.max(0, reversedQty) },
                });
              }
              // Apply to new stock's RentProduct
              const newRP = await prisma.rentProduct.findFirst({
                where: { customerId: oldCustomerId, stockId: effectiveStockId, isDeleted: false },
              });
              const newRentQty = newQty - newEmptyReturn;
              if (newRP) {
                const existingQty = newRP.quantity;
                await prisma.rentProduct.update({
                  where: { id: newRP.id },
                  data: { quantity: existingQty + newRentQty },
                });
              } else {
                await prisma.rentProduct.create({
                  data: {
                    customerId: oldCustomerId,
                    stockId: effectiveStockId,
                    quantity: newRentQty,
                  },
                });
              }
            } else {
              // Same stock, same customer — just delta
              const rp = await prisma.rentProduct.findFirst({
                where: { customerId: oldCustomerId, stockId: effectiveStockId, isDeleted: false },
              });
              if (rp) {
                const currentRPQty = rp.quantity;
                await prisma.rentProduct.update({
                  where: { id: rp.id },
                  data: { quantity: Math.max(0, currentRPQty + rentProductDelta) },
                });
              }
            }
          }

          // Update rent transaction record
          await prisma.rentTransaction.update({
            where: { id: oldRentTx.id },
            data: {
              stockId: newStockId || oldStockId!,
              filledOut: newQty,
              emptyIn: newEmptyReturn,
            },
          });
        }
      }

      // ── 6. Collection handling ────────────────────────────────────────────
      const newCollection = Number(data.collection) || 0;
      if (newCustomerId && newCollection > 0) {
        // Check if there's an existing collection from the original sale
        const existingCollection = data.collectionId
          ? await prisma.collection.findUnique({ where: { id: parseInt(data.collectionId) } })
          : null;

        if (existingCollection) {
          // Update existing collection amount
          await prisma.collection.update({
            where: { id: existingCollection.id },
            data: {
              customerId: newCustomerId,
              amount: newCollection,
            },
          });
        } else {
          // Create a new collection
          const collTrNo = await generateTrNo("collection");
          await prisma.collection.create({
            data: {
              trNo: collTrNo,
              customerId: newCustomerId,
              amount: newCollection,
              createdById: userId,
            },
          });
        }
      } else if (data.collectionId && newCollection === 0) {
        // Collection removed — soft delete
        await prisma.collection.update({
          where: { id: parseInt(data.collectionId) },
          data: { isDeleted: true },
        });
      }

      // ── 7. Update the sale record ─────────────────────────────────────────
      const sale = await prisma.sale.update({
        where: { id: saleId },
        data: {
          stockId: newStockId,
          customerId: newCustomerId,
          productId,
          isOffer: data.isOffer || false,
          discount: newDiscount,
          quantity: newQty,
          productCost,
          salePrice,
          netTotal,
          paymentType: data.paymentType || "cash",
        },
        include: { stock: true, customer: true, product: true },
      });

      return NextResponse.json(sale);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update sale";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}

// ─── DELETE (soft delete) ────────────────────────────────────────────────────

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.sale.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  }, "Owner");
}
