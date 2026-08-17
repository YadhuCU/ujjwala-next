import { Prisma } from "@/generated/client";

export type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: { createdBy: { select: { id: true; name: true } } };
}>;

export function serializeExpense(expense: ExpenseWithRelations) {
  return {
    ...expense,

    expense: expense.expense ?? undefined,

    date: expense.date ?? undefined,

    amount: expense.amount?.toNumber() ?? 0,

    createdBy: expense.createdBy ?? undefined,
  };
}

export function serializeExpenses(expenses: ExpenseWithRelations[]) {
  return expenses.map(serializeExpense);
}

export type ExpenseResponse = ReturnType<typeof serializeExpense>;
