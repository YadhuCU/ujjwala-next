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
    return NextResponse.json(customers);
  });
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();
      const customer = await prisma.customer.create({
        data: {
          name: data.name,
          address: data.address,
          phone: data.phone,
          locationId: data.locationId ? parseInt(data.locationId) : null,
          concernedPerson: data.concernedPerson,
          concernedPersonMobile: data.concernedPersonMobile,
          discount: data.discount ?? null,
          gstNumber: data.gstNumber,
          initialCylinderBalance: data.initialCylinderBalance ? parseInt(data.initialCylinderBalance) : 0,
          initialPendingAmount: data.initialPendingAmount ? parseFloat(data.initialPendingAmount) : 0,
        },
      });
      return NextResponse.json(customer, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create customer";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
