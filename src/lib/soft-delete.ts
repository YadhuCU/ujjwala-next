// Soft-deleted master data (customer, product, vendor) keeps its row so history
// still points at it, but its name is `@unique` across every row, deleted or
// not. Left as it was, the name would stay taken forever and the same customer
// could never be registered again. So a delete renames the row to free the
// name — the same idea as `…_VOID_<id>` on a voided stock batch.
//
// The suffix carries the row's id, so it is unique however many times a name
// is deleted, and it reads naturally on the old invoices that still show it:
// "Acme Traders (deleted #12)" beside the new "Acme Traders".
//
// prisma/migrations/20261125120000_free_deleted_names applies the same rule in
// SQL to rows deleted before this existed — keep the two in step.

export function retiredName(name: string, id: number, maxLength: number): string {
  const suffix = ` (deleted #${id})`;
  return `${name.slice(0, Math.max(maxLength - suffix.length, 0))}${suffix}`;
}

/** Column widths from prisma/schema.prisma (`@db.VarChar(n)`). */
export const NAME_MAX_LENGTH = {
  customer: 50,
  product: 50,
  vendor: 100,
} as const;
