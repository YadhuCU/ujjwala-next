import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        location: true,
        initialCylinderBalances: { include: { product: true } },
      },
    });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...customer,
      initialPendingAmount: parseFloat(Number(customer.initialPendingAmount).toFixed(2)),
    });
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const data = await request.json();
      const customerId = parseInt(id);
      const balances: { productId: string; quantity: number }[] =
        data.initialCylinderBalances ?? [];

      const customer = await prisma.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where: { id: customerId },
          data: {
            name: data.name,
            address: data.address || null,
            phone: data.phone || null,
            locationId: data.locationId ? parseInt(data.locationId) : null,
            concernedPerson: data.concernedPerson || null,
            concernedPersonMobile: data.concernedPersonMobile || null,
            discount: data.discount ?? null,
            gstNumber: data.gstNumber || null,
            initialPendingAmount: Math.round(
              parseFloat(String(data.initialPendingAmount || 0)) * 100
            ) / 100,
          },
        });

        for (const entry of balances) {
          const productId = parseInt(entry.productId);
          const qty = Number(entry.quantity) || 0;
          if (!productId) continue;

          await tx.customerInitialCylinderBalance.upsert({
            where: { customerId_productId: { customerId, productId } },
            update: { quantity: qty },
            create: { customerId, productId, quantity: qty },
          });
        }

        return updated;
      });

      return NextResponse.json({
        ...customer,
        initialPendingAmount: parseFloat(Number(customer.initialPendingAmount).toFixed(2)),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update customer";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.customer.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  }, "Owner");
}
