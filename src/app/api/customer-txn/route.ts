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
    const rentProducts = await prisma.rentProduct.findMany({
      where: { customerId, isDeleted: false },
    });
    const rentQty = rentProducts.reduce((sum, rp) => sum + (rp.quantity ?? 0), 0)
      + customer.initialCylinderBalance;

    // Total sales
    const sales = await prisma.sale.findMany({
      where: { customerId, isDeleted: false, saleType: "rent" },
    });
    const totalSale = sales.reduce((sum, s) => sum + Number(s.netTotal ?? 0), 0);

    // Total collections
    const collections = await prisma.collection.findMany({
      where: { customerId, isDeleted: false },
    });
    const totalCollection = collections.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

    const pendingAmount = totalSale - totalCollection + Number(customer.initialPendingAmount);

    return NextResponse.json({
      success: true,
      rent_qty: rentQty,
      total_sale: Math.round(totalSale * 100) / 100,
      total_collection: Math.round(totalCollection * 100) / 100,
      pending_amount: Math.round(pendingAmount * 100) / 100,
    });
  });
}
