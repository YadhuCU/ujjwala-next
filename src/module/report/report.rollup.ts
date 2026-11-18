import type { PaymentType } from "@/generated/enums";

/**
 * Pure folds behind the customer wise report. The service turns ledgers and
 * sale records into dated events; this file only adds them up, so the
 * arithmetic the report promises — Opening + Sales − Taken back = Balance, and
 * Opening + Sales − Receipts = Outstanding — is tested without a database.
 */

// ─── Events ──────────────────────────────────────────────────────────────────

/**
 * Money, from the customer's point of view: what they owe goes up with a sale
 * and down with a receipt. An "opening" event is migration data captured at
 * onboarding and always counts as opening, whatever its date.
 */
export type MoneyEvent = {
  customerId: number;
  at: Date;
  kind: "opening" | "sale" | "receipt";
  /** Positive. A reversal is the same kind with a negative amount. */
  amount: number;
  /** Receipts only; null where it was never recorded. */
  method?: PaymentType | null;
};

/**
 * Cylinders the customer holds, per product. "rent" adds to the holding, "back"
 * takes from it, "sold" is an outright sale — counted, but never held.
 */
export type CylinderEvent = {
  customerId: number;
  productId: number;
  at: Date;
  kind: "opening" | "rent" | "sold" | "back";
  quantity: number;
};

// ─── Rows ────────────────────────────────────────────────────────────────────

export type CylinderFigures = {
  openingEmpty: number;
  rentedQty: number;
  soldQty: number;
  emptyBack: number;
  /** openingEmpty + rentedQty − emptyBack */
  balanceEmpty: number;
};

export type CustomerProductRow = CylinderFigures & {
  productId: number;
  productName: string;
};

export type CustomerWiseRow = CylinderFigures & {
  customerId: number;
  customerName: string;
  phone?: string;
  openingBalance: number;
  salesAmount: number;
  receipts: number;
  /** e.g. ["CASH", "CHEQUE"]; "UNKNOWN" for receipts that never stored one. */
  receiptTypes: (PaymentType | "UNKNOWN")[];
  /** openingBalance + salesAmount − receipts */
  outstanding: number;
  /** One per cylinder size the customer dealt in — the sub rows. */
  products: CustomerProductRow[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const emptyFigures = (): CylinderFigures => ({
  openingEmpty: 0,
  rentedQty: 0,
  soldQty: 0,
  emptyBack: 0,
  balanceEmpty: 0,
});

function isBlank(row: CustomerWiseRow) {
  return (
    row.openingBalance === 0 &&
    row.salesAmount === 0 &&
    row.receipts === 0 &&
    row.outstanding === 0 &&
    row.products.length === 0
  );
}

/**
 * Folds every event up to `to` into one row per customer, with a sub row per
 * cylinder product. Events after `to` are ignored; events before `from` only
 * feed the opening figures. Customers with nothing to show are left out.
 */
export function buildCustomerWiseRows({
  customers,
  productNames,
  money,
  cylinders,
  from,
  to,
}: {
  customers: { id: number; name: string; phone?: string | null }[];
  productNames: Map<number, string>;
  money: MoneyEvent[];
  cylinders: CylinderEvent[];
  from: Date;
  to: Date;
}): CustomerWiseRow[] {
  const rows = new Map<number, CustomerWiseRow>();
  const methods = new Map<number, Set<PaymentType | "UNKNOWN">>();
  const perProduct = new Map<number, Map<number, CylinderFigures>>();

  for (const customer of customers)
    rows.set(customer.id, {
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone ?? undefined,
      ...emptyFigures(),
      openingBalance: 0,
      salesAmount: 0,
      receipts: 0,
      receiptTypes: [],
      outstanding: 0,
      products: [],
    });

  for (const event of money) {
    const row = rows.get(event.customerId);
    if (!row || event.at > to) continue;

    if (event.kind === "opening" || event.at < from) {
      row.openingBalance +=
        event.kind === "receipt" ? -event.amount : event.amount;
      continue;
    }

    if (event.kind === "sale") row.salesAmount += event.amount;
    else {
      row.receipts += event.amount;
      // A reversal is not a way the money came in
      if (event.amount > 0) {
        const seen = methods.get(row.customerId) ?? new Set();
        seen.add(event.method ?? "UNKNOWN");
        methods.set(row.customerId, seen);
      }
    }
  }

  for (const event of cylinders) {
    if (!rows.has(event.customerId) || event.at > to) continue;

    const products =
      perProduct.get(event.customerId) ?? new Map<number, CylinderFigures>();
    perProduct.set(event.customerId, products);
    const figures = products.get(event.productId) ?? emptyFigures();
    products.set(event.productId, figures);

    const before = event.kind === "opening" || event.at < from;

    if (event.kind === "sold") {
      // Never held, so it has no opening — it only counts inside the range
      if (!before) figures.soldQty += event.quantity;
    } else if (before) {
      figures.openingEmpty +=
        event.kind === "back" ? -event.quantity : event.quantity;
    } else if (event.kind === "rent") {
      figures.rentedQty += event.quantity;
    } else {
      figures.emptyBack += event.quantity;
    }
  }

  for (const row of rows.values()) {
    for (const [productId, figures] of perProduct.get(row.customerId) ?? []) {
      figures.balanceEmpty =
        figures.openingEmpty + figures.rentedQty - figures.emptyBack;

      const touched = Object.values(figures).some((value) => value !== 0);
      if (!touched) continue;

      row.products.push({
        productId,
        productName: productNames.get(productId) ?? `Product #${productId}`,
        ...figures,
      });
    }

    row.products.sort((a, b) => a.productName.localeCompare(b.productName));

    for (const product of row.products) {
      row.openingEmpty += product.openingEmpty;
      row.rentedQty += product.rentedQty;
      row.soldQty += product.soldQty;
      row.emptyBack += product.emptyBack;
      row.balanceEmpty += product.balanceEmpty;
    }

    row.openingBalance = round2(row.openingBalance);
    row.salesAmount = round2(row.salesAmount);
    row.receipts = round2(row.receipts);
    row.outstanding = round2(
      row.openingBalance + row.salesAmount - row.receipts,
    );
    row.receiptTypes = [...(methods.get(row.customerId) ?? [])].sort();
  }

  return [...rows.values()]
    .filter((row) => !isBlank(row))
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
}

/** Column totals for the summary tiles. */
export function summarizeCustomerWiseRows(rows: CustomerWiseRow[]) {
  const sum = (pick: (row: CustomerWiseRow) => number) =>
    round2(rows.reduce((total, row) => total + pick(row), 0));

  return {
    customerCount: rows.length,
    salesAmount: sum((row) => row.salesAmount),
    receipts: sum((row) => row.receipts),
    outstanding: sum((row) => row.outstanding),
    balanceEmpty: sum((row) => row.balanceEmpty),
  };
}

// ─── Display ─────────────────────────────────────────────────────────────────

const RECEIPT_TYPE_LABELS: Record<PaymentType | "UNKNOWN", string> = {
  CASH: "Cash",
  CHEQUE: "Cheque",
  UNKNOWN: "Not recorded",
};

/** "Cash, Cheque", or "—" when nothing was received. Shared by page and export. */
export function receiptTypeLabel(types: CustomerWiseRow["receiptTypes"]) {
  return types.length ? types.map((t) => RECEIPT_TYPE_LABELS[t]).join(", ") : "—";
}

/**
 * A customer row followed by one line per cylinder size — the shape both the
 * table and the export walk, so the file matches the screen. A customer who
 * dealt in a single size needs no sub line: the main row already says it all.
 */
export type CustomerWiseLine =
  | { kind: "customer"; row: CustomerWiseRow }
  | { kind: "product"; row: CustomerWiseRow; product: CustomerProductRow };

export function toCustomerWiseLines(rows: CustomerWiseRow[]): CustomerWiseLine[] {
  return rows.flatMap((row) => [
    { kind: "customer" as const, row },
    ...(row.products.length > 1
      ? row.products.map((product) => ({ kind: "product" as const, row, product }))
      : []),
  ]);
}
