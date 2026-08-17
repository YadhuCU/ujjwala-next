import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { NotFoundError } from "@/lib/errors";
import { SCOPES } from "@/lib/permissions";
import {
  assertCanAccessRecord,
  resolveScope,
  scopeFilter,
  type Actor,
} from "@/lib/access-scope";
import type {
  CreateExpenseInput,
  ExpenseQuery,
  UpdateExpenseInput,
} from "./expense.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const expenseInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

// Who is asking. Whether they see everyone's spending or only their own is a
// granted permission (expense.read.all vs expense.read.own), not a role name.
export type ExpenseActor = Actor;

// =============================================================================
// GUARDS
// =============================================================================

async function assertExpenseExists(
  tx: Prisma.TransactionClient,
  id: number,
  actor: ExpenseActor,
) {
  const expense = await tx.expense.findFirst({
    where: { id, isDeleted: false },
    include: expenseInclude,
  });

  if (!expense) throw new NotFoundError(`Expense #${id} not found`);

  assertCanAccessRecord(
    actor,
    resolveScope(actor, SCOPES.EXPENSE),
    expense,
    "You can only manage expenses you created",
  );

  return expense;
}

// =============================================================================
// CREATE
// =============================================================================

export async function createExpense(
  input: CreateExpenseInput,
  userId: number,
) {
  return prisma.expense.create({
    data: { ...input, createdById: userId },
    include: expenseInclude,
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getExpenses(query: ExpenseQuery, actor: ExpenseActor) {
  const { search, from, to, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    isDeleted: false,
    // "all" adds nothing; "own" narrows to this user; "none" throws.
    ...scopeFilter(actor, resolveScope(actor, SCOPES.EXPENSE)),
    ...(search && {
      expense: { contains: search, mode: "insensitive" as const },
    }),
    ...((from || to) && {
      date: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: "desc" },
      include: expenseInclude,
    }),
    prisma.expense.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getExpenseById(id: number, actor: ExpenseActor) {
  return assertExpenseExists(prisma, id, actor);
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateExpense(
  id: number,
  input: UpdateExpenseInput,
  actor: ExpenseActor,
) {
  return prisma.$transaction(async (tx) => {
    await assertExpenseExists(tx, id, actor);

    return tx.expense.update({
      where: { id },
      data: input,
      include: expenseInclude,
    });
  });
}

// =============================================================================
// DELETE
// =============================================================================

export async function deleteExpense(id: number, actor: ExpenseActor) {
  return prisma.$transaction(async (tx) => {
    await assertExpenseExists(tx, id, actor);

    return tx.expense.update({
      where: { id },
      data: { isDeleted: true },
    });
  });
}
