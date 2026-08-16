import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { UpdateExpenseSchema } from "@/module/expense/expense.payload.schema";
import * as ExpenseService from "@/module/expense/expense.service";
import { serializeExpense } from "@/module/expense/expense.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, { params }: Props) {
  return withAuth(async ({ userId, permissions, isOwner }) => {
    const { id } = await params;

    const expense = await ExpenseService.getExpenseById(Number(id), {
      userId,
      permissions,
      isOwner,
    });

    return formatResponse({ data: serializeExpense(expense) });
  }, [PERMISSIONS.EXPENSE_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ userId, permissions, isOwner }) => {
      const { id } = await params;
      const data = UpdateExpenseSchema.parse(await req.json());

      const expense = await ExpenseService.updateExpense(Number(id), data, {
        userId,
        permissions,
        isOwner,
      });

      return formatResponse({
        data: serializeExpense(expense),
        message: "Expense updated successfully",
      });
    },
    [PERMISSIONS.EXPENSE_UPDATE],
  );
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ userId, permissions, isOwner }) => {
      const { id } = await params;

      await ExpenseService.deleteExpense(Number(id), {
        userId,
        permissions,
        isOwner,
      });

      return formatResponse({
        data: null,
        message: "Expense deleted successfully",
      });
    },
    [PERMISSIONS.EXPENSE_DELETE],
  );
}
