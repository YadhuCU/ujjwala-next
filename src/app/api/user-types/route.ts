import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const userTypes = await prisma.userType.findMany({
      where: { isDeleted: false },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(userTypes);
  }, "admin");
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();
      const userType = await prisma.userType.create({
        data: { name: data.name, role: data.role },
      });
      return NextResponse.json(userType, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create user type";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "admin");
}
