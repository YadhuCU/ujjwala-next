import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateExpenseSchema,
  ExpenseQuerySchema,
} from "@/module/expense/expense.payload.schema";
import * as ExpenseService from "@/module/expense/expense.service";
import { serializeExpenses } from "@/module/expense/expense.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async ({ id, roles }) => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = ExpenseQuerySchema.parse(params);

    const result = await ExpenseService.getExpenses(query, {
      userId: Number(id),
      roles: roles ?? [],
    });

    return formatResponse({
      data: serializeExpenses(result.data),
      meta: result.meta,
    });
  }, [PERMISSIONS.EXPENSE_READ]);
}

export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const data = CreateExpenseSchema.parse(await request.json());
      const expense = await ExpenseService.createExpense(data, Number(id));

      return formatResponse({
        data: expense,
        status: 201,
        message: "Expense created successfully",
      });
    },
    [PERMISSIONS.EXPENSE_CREATE],
  );
}
