import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const customers = await prisma.customer.findMany({
      where: { isDeleted: false },
      include: { location: true },
      orderBy: { createdAt: "desc" },
    });
    // Explicitly convert Decimal fields to avoid serialization issues
    return NextResponse.json(
      customers.map((c) => ({
        ...c,
        initialPendingAmount: parseFloat(Number(c.initialPendingAmount).toFixed(2)),
      }))
    );
  });
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();
      const balances: { productId: string; quantity: number }[] =
        data.initialCylinderBalances ?? [];

      const customer = await prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            name: data.name,
            address: data.address || null,
            phone: data.phone || null,
            locationId: data.locationId ? parseInt(data.locationId) : null,
            concernedPerson: data.concernedPerson || null,
            concernedPersonMobile: data.concernedPersonMobile || null,
            discount: data.discount ?? null,
            gstNumber: data.gstNumber || null,
            initialCylinderBalance: 0,
            // Round to 2dp to prevent floating-point drift
            initialPendingAmount: Math.round(
              parseFloat(String(data.initialPendingAmount || 0)) * 100
            ) / 100,
          },
        });

        // Seed per-product opening cylinder balances
        for (const entry of balances) {
          const productId = parseInt(entry.productId);
          const qty = Number(entry.quantity) || 0;
          if (!productId || qty <= 0) continue;

          await tx.customerInitialCylinderBalance.upsert({
            where: { customerId_productId: { customerId: created.id, productId } },
            update: { quantity: qty },
            create: { customerId: created.id, productId, quantity: qty },
          });
        }

        return created;
      });

      return NextResponse.json({
        ...customer,
        initialPendingAmount: parseFloat(Number(customer.initialPendingAmount).toFixed(2)),
      }, { status: 201 });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create customer";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
