import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/api-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const user = await prisma.account.findUnique({
      where: { id: parseInt(id) },
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    return NextResponse.json(safeUser);
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const data = await request.json();

      const updateData: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        role: data.role,
      };

      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }

      const user = await prisma.account.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safeUser } = user;
      return NextResponse.json(safeUser);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.account.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });
    return NextResponse.json({ success: true });
  }, "Owner");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const data = await request.json();

    if (typeof data.isActive === "boolean") {
      await prisma.account.update({
        where: { id: parseInt(id) },
        data: { isActive: data.isActive },
      });
    }

    return NextResponse.json({ success: true });
  }, "Owner");
}
