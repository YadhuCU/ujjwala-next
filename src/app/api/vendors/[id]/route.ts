import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const vendor = await prisma.vendor.findUnique({
      where: { id: parseInt(id) },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(vendor);
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const data = await request.json();
      const vendor = await prisma.vendor.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name,
          phone: data.phone || null,
          address: data.address || null,
          gstNumber: data.gstNumber || null,
        },
      });
      return NextResponse.json(vendor);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.vendor.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true },
    });
    return NextResponse.json({ success: true });
  }, "Owner");
}
