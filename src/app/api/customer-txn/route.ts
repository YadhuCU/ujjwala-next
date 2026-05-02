import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

/** Round to 2 decimal places to avoid floating-point drift in sums */
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const custId = searchParams.get("cust_id");

    if (!custId) {
      return NextResponse.json({ error: "Missing cust_id" }, { status: 400 });
    }

    const customerId = parseInt(custId);
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // ── Cylinder counts aggregated by product ──────────────────────────────
    // 1. Rent product rows (per stock batch)
    const rentProductRows = await prisma.rentProduct.findMany({
      where: { customerId, isDeleted: false },
      include: { stock: { include: { product: true } } },
    });

    // 2. Opening cylinder balances (per product)
    const initialBalances = await prisma.customerInitialCylinderBalance.findMany({
      where: { customerId },
      include: { product: true },
    });

    // Aggregate both into a per-product map
    const cylinderMap: Record<number, { productName: string; quantity: number }> = {};

    for (const r of rentProductRows) {
      const pid = r.stock?.productId;
      if (!pid) continue;
      if (!cylinderMap[pid]) {
        cylinderMap[pid] = { productName: r.stock?.product?.name ?? "Unknown", quantity: 0 };
      }
      cylinderMap[pid].quantity += r.quantity;
    }

    for (const ib of initialBalances) {
      const pid = ib.productId;
      if (!cylinderMap[pid]) {
        cylinderMap[pid] = { productName: ib.product?.name ?? "Unknown", quantity: 0 };
      }
      cylinderMap[pid].quantity += ib.quantity;
    }

    const cylinderBreakdown = Object.entries(cylinderMap).map(([pid, v]) => ({
      productId: Number(pid),
      productName: v.productName,
      quantity: v.quantity,
    }));

    const rentQty = cylinderBreakdown.reduce((s, b) => s + b.quantity, 0)
      + Number(customer.initialCylinderBalance ?? 0); // legacy compat

    // ── Pending amount calculation ─────────────────────────────────────────
    // Old commercial sales (legacy Sale model)
    const rentSales = await prisma.sale.aggregate({
      where: { customerId, saleType: "rent", isDeleted: false },
      _sum: { netTotal: true },
    });

    // Old collections not linked to dom/arb/commercial sale
    const legacyCollections = await prisma.collection.aggregate({
      where: {
        customerId,
        isDeleted: false,
        domSaleId: null,
        arbSaleId: null,
        commercialSaleId: null,
      },
      _sum: { amount: true },
    });

    const domSales = await prisma.domSale.aggregate({
      where: { customerId, isDeleted: false },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const arbSales = await prisma.arbSale.aggregate({
      where: { customerId, isDeleted: false },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const commercialSales = await prisma.commercialSale.aggregate({
      where: { customerId, isDeleted: false },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const oldCommercialPending = round2(
      Number(rentSales._sum.netTotal ?? 0) - Number(legacyCollections._sum.amount ?? 0)
    );
    const newCommercialPending = round2(
      Number(commercialSales._sum.totalAmount ?? 0) - Number(commercialSales._sum.paidAmount ?? 0)
    );
    const domPending = round2(
      Number(domSales._sum.totalAmount ?? 0) - Number(domSales._sum.paidAmount ?? 0)
    );
    const arbPending = round2(
      Number(arbSales._sum.totalAmount ?? 0) - Number(arbSales._sum.paidAmount ?? 0)
    );

    const pendingAmount = round2(
      oldCommercialPending +
      newCommercialPending +
      domPending +
      arbPending +
      round2(Number(customer.initialPendingAmount ?? 0))
    );

    return NextResponse.json({
      success: true,
      rent_qty: rentQty,
      pending_amount: pendingAmount,
      cylinder_breakdown: cylinderBreakdown,
      breakdown: {
        commercial: round2(oldCommercialPending + newCommercialPending),
        domestic: domPending,
        arb: arbPending,
        initial: round2(Number(customer.initialPendingAmount ?? 0)),
      },
    });
  });
}
