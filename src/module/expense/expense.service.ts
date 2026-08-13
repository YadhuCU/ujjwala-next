import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { ROLES } from "@/lib/permissions";
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

// Who is asking — expenses are private to their author unless you are an owner.
export type ExpenseActor = { userId: number; roles: string[] };

// =============================================================================
// PURE HELPERS
// =============================================================================

function isOwner(actor: ExpenseActor): boolean {
  return actor.roles.includes(ROLES.OWNER);
}

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

  if (!isOwner(actor) && expense.createdById !== actor.userId)
    throw new ForbiddenError("You can only manage expenses you created");

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
    // Non-owners only ever see their own spending
    ...(!isOwner(actor) && { createdById: actor.userId }),
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
