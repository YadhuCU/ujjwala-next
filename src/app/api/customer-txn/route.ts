import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

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

  // Rent quantity (cylinders in hand)
    const rentProducts = await prisma.rentProduct.aggregate({
      where: { customerId, isDeleted: false },
      _sum: { quantity: true },
    });
    const rentQty =
      Number(rentProducts._sum.quantity ?? 0) +
      Number(customer.initialCylinderBalance ?? 0);

    // Total commercial sales
    const rentSales = await prisma.sale.aggregate({
      where: { customerId, saleType: "rent", isDeleted: false },
      _sum: { netTotal: true },
    });

    // Total commercial collections
    const commercialCollections = await prisma.collection.aggregate({
      where: { customerId, isDeleted: false, domSaleId: null, arbSaleId: null },
      _sum: { amount: true },
    });

    // DomSale pending
    const domSales = await prisma.domSale.aggregate({
      where: { customerId, isDeleted: false },
      _sum: { totalAmount: true, paidAmount: true },
    });

    // ArbSale pending
    const arbSales = await prisma.arbSale.aggregate({
      where: { customerId, isDeleted: false },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const commercialPending =
      Number(rentSales._sum.netTotal ?? 0) -
      Number(commercialCollections._sum.amount ?? 0);

    const domPending =
      Number(domSales._sum.totalAmount ?? 0) -
      Number(domSales._sum.paidAmount ?? 0);

    const arbPending =
      Number(arbSales._sum.totalAmount ?? 0) -
      Number(arbSales._sum.paidAmount ?? 0);

    const pendingAmount =
      commercialPending +
      domPending +
      arbPending +
      Number(customer.initialPendingAmount ?? 0);

    return NextResponse.json({
      success: true,
      rent_qty: rentQty,
      pending_amount: pendingAmount,
      breakdown: {
        commercial: commercialPending,
        domestic: domPending,
        arb: arbPending,
        initial: Number(customer.initialPendingAmount ?? 0),
      },
    });
  });
}
