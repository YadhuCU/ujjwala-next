import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { NotFoundError } from "@/lib/errors";
import { formatResponse } from "@/lib/response";
import { serializeCustomerWithDetails } from "@/module/customer/customer.serializer";
import { UpdateCustomerSchema } from "@/module/customer/customer.schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        location: true,
        initialCylinderBalances: true,
      },
    });

    if (!customer) {
      throw new NotFoundError("Cusotomer Not found");
    }

    return formatResponse({ data: serializeCustomerWithDetails(customer) });
  }, [PERMISSIONS.CUSTOMER_READ]);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;

    const body = await request.json();
    const data = UpdateCustomerSchema.parse(body);
    console.log({ data });

    const customerId = parseInt(id);

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          name: data.name,
          address: data.address || null,
          phone: data.phone || null,
          locationId: data.locationId ? data.locationId : null,
          concernedPerson: data.concernedPerson || null,
          concernedPersonMobile: data.concernedPersonMobile || null,
          discount: data.discount ?? null,
          gstNumber: data.gstNumber || null,
        },
      });

      return updated;
    });

    return NextResponse.json({
      ...customer,
      initialPendingAmount: parseFloat(
        Number(customer.initialPendingAmount).toFixed(2),
      ),
    });
  }, [PERMISSIONS.CUSTOMER_UPDATE]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.customer.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true },
    });
    return NextResponse.json({ success: true });
  }, [PERMISSIONS.CUSTOMER_DELETE]);
}
