# expense

**Purpose.** Spending records, private to whoever recorded them unless granted wider sight.

**Files.** `src/module/expense/*` · UI `src/app/(dashboard)/expenses/` ·
tests `expense.service.integration.test.ts`

**Model.** `Expense { id, expense? (text), date? (date), amount?, isDeleted, createdById }`.

**Scope.** `ExpenseActor = Actor { userId, permissions, isOwner? }`. The pair
`SCOPES.EXPENSE = { all: expense.read.all, own: expense.read.own }` via
`resolveScope`:
- list: `scopeFilter` → `{}` / `{ createdById: userId }` / **throws** on `"none"`;
- single / update / delete: `assertExpenseExists` → `assertCanAccessRecord`
  ("You can only manage expenses you created").
`expense.read` opens the module; a role needs one of the scope codes too, or it
sees a 403 (the role editor warns about this).

**Routes.** `GET/POST /api/expenses`, `GET/PUT/DELETE /api/expenses/[id]` —
`expense.read / create / update / delete`; the scope is decided in the service.

**History.** Was `roles.includes("OWNER")` until 2026-08-16 — a new role could
never see everyone's expenses.
