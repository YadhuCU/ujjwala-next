import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { makeUser } from "@/test/factories";
import * as ExpenseService from "./expense.service";

let ownerId: number;
let staffId: number;
let otherStaffId: number;

const owner = () => ({ userId: ownerId, roles: [ROLES.OWNER] });
const staff = () => ({ userId: staffId, roles: [ROLES.OFFICE_STAFF] });
const otherStaff = () => ({
  userId: otherStaffId,
  roles: [ROLES.FIELD_STAFF],
});

const query = { page: 1, limit: 20 };

beforeEach(async () => {
  ownerId = (await makeUser("Owner")).id;
  staffId = (await makeUser("Office Staff")).id;
  otherStaffId = (await makeUser("Field Staff")).id;
});

function expenseInput(expense: string, amount = 500) {
  return { expense, date: new Date("2026-08-14"), amount };
}

async function seedThreeExpenses() {
  await ExpenseService.createExpense(expenseInput("Owner fuel"), ownerId);
  await ExpenseService.createExpense(expenseInput("Staff fuel"), staffId);
  await ExpenseService.createExpense(
    expenseInput("Other staff fuel"),
    otherStaffId,
  );
}

// Expenses are private to whoever recorded them — a leak here is not a crash,
// it is one staff member reading another's spending.
describe("getExpenses", () => {
  it("shows an owner everyone's expenses", async () => {
    await seedThreeExpenses();

    const { data, meta } = await ExpenseService.getExpenses(query, owner());

    expect(meta.total).toBe(3);
    expect(data).toHaveLength(3);
  });

  it("shows staff only their own", async () => {
    await seedThreeExpenses();

    const { data, meta } = await ExpenseService.getExpenses(query, staff());

    expect(meta.total).toBe(1);
    expect(data[0].expense).toBe("Staff fuel");
  });
});

describe("getExpenseById", () => {
  it("lets the author open their own", async () => {
    const created = await ExpenseService.createExpense(
      expenseInput("Staff fuel"),
      staffId,
    );

    const found = await ExpenseService.getExpenseById(created.id, staff());
    expect(found.id).toBe(created.id);
  });

  it("refuses another staff member's expense", async () => {
    const created = await ExpenseService.createExpense(
      expenseInput("Staff fuel"),
      staffId,
    );

    await expect(
      ExpenseService.getExpenseById(created.id, otherStaff()),
    ).rejects.toThrow(/only manage expenses you created/);
  });

  it("lets an owner open anyone's", async () => {
    const created = await ExpenseService.createExpense(
      expenseInput("Staff fuel"),
      staffId,
    );

    const found = await ExpenseService.getExpenseById(created.id, owner());
    expect(found.id).toBe(created.id);
  });
});

describe("updateExpense", () => {
  it("refuses another staff member's expense", async () => {
    const created = await ExpenseService.createExpense(
      expenseInput("Staff fuel"),
      staffId,
    );

    await expect(
      ExpenseService.updateExpense(
        created.id,
        expenseInput("Hijacked", 9999),
        otherStaff(),
      ),
    ).rejects.toThrow(/only manage expenses you created/);

    const untouched = await prisma.expense.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(untouched.expense).toBe("Staff fuel");
  });

  it("lets the author correct their own", async () => {
    const created = await ExpenseService.createExpense(
      expenseInput("Staff fuel", 500),
      staffId,
    );

    const updated = await ExpenseService.updateExpense(
      created.id,
      expenseInput("Staff fuel", 650),
      staff(),
    );

    expect(Number(updated.amount)).toBe(650);
  });
});

describe("deleteExpense", () => {
  it("refuses another staff member's expense", async () => {
    const created = await ExpenseService.createExpense(
      expenseInput("Staff fuel"),
      staffId,
    );

    await expect(
      ExpenseService.deleteExpense(created.id, otherStaff()),
    ).rejects.toThrow(/only manage expenses you created/);
  });

  it("soft-deletes and drops it from the list", async () => {
    const created = await ExpenseService.createExpense(
      expenseInput("Staff fuel"),
      staffId,
    );

    await ExpenseService.deleteExpense(created.id, staff());

    const { meta } = await ExpenseService.getExpenses(query, owner());
    expect(meta.total).toBe(0);

    const row = await prisma.expense.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.isDeleted).toBe(true);
  });
});

describe("date filtering", () => {
  it("keeps expenses outside the range out of the list", async () => {
    await ExpenseService.createExpense(
      { expense: "July", date: new Date("2026-07-10"), amount: 100 },
      ownerId,
    );
    await ExpenseService.createExpense(
      { expense: "August", date: new Date("2026-08-10"), amount: 200 },
      ownerId,
    );

    const { data } = await ExpenseService.getExpenses(
      { ...query, from: new Date("2026-08-01"), to: new Date("2026-08-31") },
      owner(),
    );

    expect(data.map((e) => e.expense)).toEqual(["August"]);
  });
});
