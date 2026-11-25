// Profit report — the pure fold. The service loads every sale in the range as
// a `ProfitInvoice`; everything below is arithmetic, so it is unit-tested
// without a database (report.profit.test.ts).
//
// Sales are what the customer was charged: each invoice's `totalAmount`, which
// is already net of its discount, spread over its lines by line value so that
// the item rows add up to exactly the invoice total. Cost is what the batch the
// line drew from cost us (`Stock.productCost` × quantity) — the same rule the
// dashboard uses, so the two agree on gross profit.

// =============================================================================
// CONSTANTS
// =============================================================================

/** Each sale module is one category, in the order the agency reads them. */
export const PROFIT_CATEGORIES = ["COMMERCIAL", "DOMESTIC", "ARB"] as const;

export type ProfitCategory = (typeof PROFIT_CATEGORIES)[number];

export const PROFIT_CATEGORY_LABEL: Record<ProfitCategory, string> = {
  COMMERCIAL: "Commercial",
  DOMESTIC: "Domestic",
  ARB: "ARB",
};

export type ProfitView = "category" | "item";

// =============================================================================
// TYPES
// =============================================================================

export type ProfitLine = {
  productId: number | null;
  productName: string;
  quantity: number;
  /** quantity × rate, before the invoice discount */
  lineValue: number;
  /** What one unit of the batch cost; null when the batch has no cost */
  unitCost: number | null;
};

export type ProfitInvoice = {
  category: ProfitCategory;
  invoiceId: number;
  /** What the customer was charged, net of discount */
  totalAmount: number;
  lines: ProfitLine[];
};

export type ProfitRow = {
  key: string;
  category: ProfitCategory;
  categoryLabel: string;
  /** Item rows only */
  productId: number | null;
  productName: string | null;
  invoiceCount: number;
  qty: number;
  sales: number;
  cost: number;
  profit: number;
  /** Profit as a % of sales, one decimal; null when nothing was sold */
  margin: number | null;
  /** Units sold from a batch with no cost recorded — their cost counts as 0 */
  uncostedQty: number;
};

export type ProfitSummary = {
  invoiceCount: number;
  qty: number;
  sales: number;
  cost: number;
  grossProfit: number;
  margin: number | null;
  uncostedQty: number;
};

// =============================================================================
// PURE HELPERS
// =============================================================================

const round2 = (value: number) => Math.round(value * 100) / 100;

export function marginOf(profit: number, sales: number): number | null {
  if (sales === 0) return null;
  return Math.round((profit / sales) * 1000) / 10;
}

/**
 * Splits an invoice's total over its lines by line value, falling back to
 * quantity when every line was priced at zero. The last line takes the
 * rounding remainder, so the shares always sum to the invoice total exactly.
 */
export function allocateInvoice(invoice: ProfitInvoice): number[] {
  const { lines, totalAmount } = invoice;
  if (lines.length === 0) return [];

  const byValue = lines.reduce((sum, l) => sum + Math.max(l.lineValue, 0), 0);
  const byQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  const weights =
    byValue > 0
      ? lines.map((l) => Math.max(l.lineValue, 0) / byValue)
      : byQty > 0
        ? lines.map((l) => l.quantity / byQty)
        : lines.map(() => 0);

  const shares = weights.map((w) => round2(totalAmount * w));
  if (weights.some((w) => w > 0)) {
    const allocated = shares.slice(0, -1).reduce((sum, s) => sum + s, 0);
    shares[shares.length - 1] = round2(totalAmount - allocated);
  }
  return shares;
}

type Accumulator = Omit<ProfitRow, "profit" | "margin"> & {
  invoices: Set<number>;
};

function emptyAccumulator(
  key: string,
  category: ProfitCategory,
  productId: number | null,
  productName: string | null,
): Accumulator {
  return {
    key,
    category,
    categoryLabel: PROFIT_CATEGORY_LABEL[category],
    productId,
    productName,
    invoiceCount: 0,
    qty: 0,
    sales: 0,
    cost: 0,
    uncostedQty: 0,
    invoices: new Set(),
  };
}

function finish({ invoices, ...row }: Accumulator): ProfitRow {
  const sales = round2(row.sales);
  const cost = round2(row.cost);
  const profit = round2(sales - cost);
  return {
    ...row,
    invoiceCount: invoices.size,
    sales,
    cost,
    profit,
    margin: marginOf(profit, sales),
  };
}

// =============================================================================
// FOLD
// =============================================================================

/**
 * One row per category (every category asked for, even at zero, so a quiet
 * month reads as zero rather than missing) or one row per item within its
 * category. The item rows of a category sum to that category's row.
 */
export function buildProfitRows(
  invoices: ProfitInvoice[],
  view: ProfitView,
  categories: readonly ProfitCategory[] = PROFIT_CATEGORIES,
): ProfitRow[] {
  const rows = new Map<string, Accumulator>();

  if (view === "category") {
    for (const category of categories) {
      rows.set(category, emptyAccumulator(category, category, null, null));
    }
  }

  for (const invoice of invoices) {
    if (!categories.includes(invoice.category)) continue;
    const shares = allocateInvoice(invoice);

    invoice.lines.forEach((line, index) => {
      const key =
        view === "category"
          ? invoice.category
          : `${invoice.category}:${line.productId ?? line.productName}`;
      let row = rows.get(key);
      if (!row) {
        row =
          view === "category"
            ? emptyAccumulator(key, invoice.category, null, null)
            : emptyAccumulator(
                key,
                invoice.category,
                line.productId,
                line.productName,
              );
        rows.set(key, row);
      }

      row.invoices.add(invoice.invoiceId);
      row.qty += line.quantity;
      row.sales += shares[index];
      row.cost += (line.unitCost ?? 0) * line.quantity;
      if (line.unitCost === null) row.uncostedQty += line.quantity;
    });
  }

  const order = (c: ProfitCategory) => PROFIT_CATEGORIES.indexOf(c);
  return [...rows.values()]
    .map(finish)
    .sort(
      (a, b) =>
        order(a.category) - order(b.category) ||
        (a.productName ?? "").localeCompare(b.productName ?? ""),
    );
}

/** Totals over the rows. Invoices are counted once, however many items. */
export function summarizeProfit(
  invoices: ProfitInvoice[],
  rows: ProfitRow[],
  categories: readonly ProfitCategory[] = PROFIT_CATEGORIES,
): ProfitSummary {
  const sum = (pick: (row: ProfitRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  const sales = round2(sum((r) => r.sales));
  const cost = round2(sum((r) => r.cost));
  const grossProfit = round2(sales - cost);

  return {
    invoiceCount: invoices.filter(
      (i) => categories.includes(i.category) && i.lines.length > 0,
    ).length,
    qty: sum((r) => r.qty),
    sales,
    cost,
    grossProfit,
    margin: marginOf(grossProfit, sales),
    uncostedQty: sum((r) => r.uncostedQty),
  };
}
