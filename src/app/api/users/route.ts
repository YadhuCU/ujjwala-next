import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const users = await prisma.account.findMany({
      where: { isDeleted: false },
      include: { usertype: true },
      orderBy: { createdAt: "desc" },
    });
    const safeUsers = users.map(({ password: _, ...user }) => user);
    return NextResponse.json(safeUsers);
  }, "admin");
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
          usertypeId: data.usertypeId ? parseInt(data.usertypeId) : null,
        },
      });
      const { password: _, ...safeUser } = user;
      return NextResponse.json(safeUser, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create user";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "admin");
}
