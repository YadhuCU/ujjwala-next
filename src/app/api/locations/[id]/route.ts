import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const location = await prisma.location.findUnique({
      where: { id: parseInt(id) },
    });
    if (!location) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(location);
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const data = await request.json();
      const location = await prisma.location.update({
        where: { id: parseInt(id) },
        data: { name: data.name, district: data.district, pincode: data.pincode, locality: data.locality },
      });
      return NextResponse.json(location);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "admin");
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.location.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  }, "admin");
}
