import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS, ROLES } from "@/lib/permissions";
import { ExpenseWhereInput } from "@/generated/models";

export async function GET() {
  return withAuth(async (user) => {
    const userId = user.id;
    const role = user.role
    const where:ExpenseWhereInput = { isDeleted: false };
    if (role !== ROLES.OWNER) where.createdById = userId;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(expenses);
  }, [PERMISSIONS.EXPENSE_READ]);
}

export async function POST(request: Request) {
  return withAuth(async (user) => {
    const userId = user.id
    try {
      const data = await request.json();
      const expense = await prisma.expense.create({
        data: {
          expense: data.expense,
          date: data.date ? new Date(data.date) : new Date(),
          amount: data.amount != null ? Number(data.amount) : null,
          createdById: userId,
        },
      });
      return NextResponse.json(expense, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create expense";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, [PERMISSIONS.EXPENSE_CREATE]);
}
