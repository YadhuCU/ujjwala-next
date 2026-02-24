import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const users = await prisma.account.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });
    const safeUsers = users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...rest } = user;
      return rest;
    });
    return NextResponse.json(safeUsers);
  }, "Owner");
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await prisma.account.create({
        data: {
          username: data.username,
          name: data.name,
          password: hashedPassword,
          email: data.email,
          mobile: data.mobile,
          role: data.role,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safeUser } = user;
      return NextResponse.json(safeUser, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create user";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}
