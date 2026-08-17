import { Prisma } from "@/generated/client";

/**
 * Report rows go out as plain numbers, like every other module. Without this
 * the client receives Prisma Decimals as strings and every page has to remember
 * to wrap each field in Number().
 */

type Money = Prisma.Decimal | null;

const money = (value: Money) => (value === null ? undefined : value.toNumber());

// ─── Sale reports (dom / arb / commercial share a shape) ─────────────────────

export type SaleReportRow = {
  id: number;
  trNo: string | null;
  createdAt: Date;
  totalAmount: Money;
  paidAmount: Money;
  discount: Money;
  paymentType: string;
  customer: { id: number; name: string } | null;
  createdBy: { id: number; name: string | null } | null;
  items: {
    id: number;
    quantity: number;
    salePrice: Money;
    netTotal: Money;
    saleType?: string;
    cylindersDispatched?: number;
    cylindersReturned?: number;
    product: { name: string } | null;
    stock: { batchNo: string } | null;
  }[];
};

export function serializeSaleReportRow(row: SaleReportRow) {
  return {
    ...row,
    totalAmount: money(row.totalAmount) ?? 0,
    paidAmount: money(row.paidAmount) ?? 0,
    discount: money(row.discount),
    customer: row.customer ?? undefined,
    createdBy: row.createdBy ?? undefined,
    items: row.items.map((item) => ({
      ...item,
      salePrice: money(item.salePrice),
      netTotal: money(item.netTotal),
      product: item.product ?? undefined,
      stock: item.stock ?? undefined,
    })),
  };
}

// ─── Purchase report ─────────────────────────────────────────────────────────

export type PurchaseReportRow = {
  id: number;
  invoiceNo: string | null;
  purchaseDate: Date;
  totalCost: Prisma.Decimal;
  vendor: { id: number; name: string } | null;
  items: {
    id: number;
    batchNo: string;
    quantity: number;
    purchaseType: string;
    unitCost: Money;
    totalCost: Money;
    product: { name: string } | null;
  }[];
};

export function serializePurchaseReportRow(row: PurchaseReportRow) {
  return {
    ...row,
    invoiceNo: row.invoiceNo ?? undefined,
    totalCost: row.totalCost.toNumber(),
    vendor: row.vendor ?? undefined,
    items: row.items.map((item) => ({
      ...item,
      unitCost: money(item.unitCost),
      totalCost: money(item.totalCost),
      product: item.product ?? undefined,
    })),
  };
}

// ─── Expense report ──────────────────────────────────────────────────────────

export type ExpenseReportRow = {
  id: number;
  expense: string | null;
  date: Date | null;
  amount: Money;
  createdBy: { id: number; name: string | null } | null;
};

export function serializeExpenseReportRow(row: ExpenseReportRow) {
  return {
    ...row,
    expense: row.expense ?? undefined,
    date: row.date ?? undefined,
    amount: money(row.amount) ?? 0,
    createdBy: row.createdBy ?? undefined,
  };
}

// ─── Response envelopes the report pages consume ─────────────────────────────

export type ReportPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SaleReportSummary = {
  invoiceCount: number;
  totalSubtotal: number;
  totalDiscount: number;
  totalNetTotal: number;
};

export type SaleReportResponse = {
  summary: SaleReportSummary;
  data: ReturnType<typeof serializeSaleReportRow>[];
  pagination: ReportPagination;
};

export type PurchaseReportResponse = {
  summary: { invoiceCount: number; totalAmount: number };
  data: ReturnType<typeof serializePurchaseReportRow>[];
  pagination: ReportPagination;
};

export type ExpenseReportResponse = {
  summary: { expenseCount: number; totalAmount: number };
  data: ReturnType<typeof serializeExpenseReportRow>[];
  pagination: ReportPagination;
};

export type SaleByProductResponse = {
  summary: {
    totalQuantity: number;
    totalAmount: number;
    rentedQuantity: number;
  };
  data: {
    productId: number;
    productName: string;
    totalQuantity: number;
    totalAmount: number;
  }[];
  pagination: ReportPagination;
};
