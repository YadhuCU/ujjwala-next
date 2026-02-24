import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async ({ userId, role }) => {
    const where: Record<string, unknown> = { isDeleted: false };
    if (role !== "Owner") where.createdById = userId;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(expenses);
  });
}

export async function POST(request: Request) {
  return withAuth(async ({ userId }) => {
    try {
      const data = await request.json();
      const expense = await prisma.expense.create({
        data: {
          expense: data.expense,
          date: data.date ? new Date(data.date) : new Date(),
          amount: data.amount,
          createdById: userId,
        },
      });
      return NextResponse.json(expense, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create expense";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
