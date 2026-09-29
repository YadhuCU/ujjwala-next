/**
 * Sale reports list one row per item sold rather than one per invoice, so that
 * item, quantity and type each get a column of their own — and so an export
 * opens in Excel as rows that can be filtered and summed.
 *
 * The screen and the export both go through this, so they cannot disagree
 * about what a row is. No imports: it is shared by a client component.
 */

export type SaleLine<S extends { items: readonly unknown[] }> = {
  sale: S;
  /** Undefined for an invoice with no items — a collection-only visit. */
  item: S["items"][number] | undefined;
  /**
   * The invoice's first line. Only it carries the invoice's discount, paid and
   * total, so a column of totals still adds up to the real figure instead of
   * counting each invoice once per item.
   */
  first: boolean;
  /** Position within the invoice, for a stable row key. */
  index: number;
};

export function toSaleLines<S extends { items: readonly unknown[] }>(
  sales: readonly S[],
): SaleLine<S>[] {
  return sales.flatMap((sale) =>
    sale.items.length === 0
      ? [{ sale, item: undefined, first: true, index: 0 }]
      : sale.items.map((item, index) => ({
          sale,
          item,
          first: index === 0,
          index,
        })),
  );
}
