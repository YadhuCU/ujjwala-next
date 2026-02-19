import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: { location: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(customer);
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const data = await request.json();
      const customer = await prisma.customer.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name,
          address: data.address,
          phone: data.phone,
          locationId: data.locationId ? parseInt(data.locationId) : null,
          concernedPerson: data.concernedPerson,
          concernedPersonMobile: data.concernedPersonMobile,
          discount: data.discount,
          gstNumber: data.gstNumber,
          initialCylinderBalance: data.initialCylinderBalance ? parseInt(data.initialCylinderBalance) : 0,
          initialPendingAmount: data.initialPendingAmount ? parseFloat(data.initialPendingAmount) : 0,
        },
      });
      return NextResponse.json(customer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update customer";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "admin");
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.customer.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  }, "admin");
}
