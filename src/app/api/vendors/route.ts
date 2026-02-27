import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const vendors = await prisma.vendor.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(vendors);
  });
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();
      const vendor = await prisma.vendor.create({
        data: {
          name: data.name,
          phone: data.phone || null,
          address: data.address || null,
          gstNumber: data.gstNumber || null,
        },
      });
      return NextResponse.json(vendor, { status: 201 });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create vendor";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}
