// ─── Query Key Factory ──────────────────────────────────────────────────────
// Centralized query keys for TanStack Query.
// Each entity provides: .all (for invalidation), .lists() (for list queries),
// and .detail(id) (for single-item queries).

import { ProductType } from "@prisma/client";

export const queryKeys = {
  sales: {
    all: ["sales"] as const,
    lists: () => ["sales"] as const,
    detail: (id: string) => ["sales", id] as const,
  },
  domSales: {
    all: ["dom-sales"] as const,
    lists: () => ["dom-sales"] as const,
    detail: (id: string) => ["dom-sales", id] as const,
  },
  arbSales: {
    all: ["arb-sales"] as const,
    lists: () => ["arb-sales"] as const,
    detail: (id: string) => ["arb-sales", id] as const,
  },
  commercialSales: {
    all: ["commercial-sales"] as const,
    lists: () => ["commercial-sales"] as const,
    detail: (id: string) => ["commercial-sales", id] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    lists: () => ["expenses"] as const,
    detail: (id: string) => ["expenses", id] as const,
  },
  customers: {
    all: ["customers"] as const,
    lists: () => ["customers"] as const,
    detail: (id: string) => ["customers", id] as const,
  },
  customerTxn: {
    all: ["customer-txn"] as const,
    detail: (custId: string) => ["customer-txn", custId] as const,
  },
  stocks: {
    all: ["stocks"] as const,
    lists: (type?: ProductType) => ["stocks", type] as const,
    detail: (id: string) => ["stocks", id] as const,
  },
  vendors: {
    all: ["vendors"] as const,
    lists: () => ["vendors"] as const,
    detail: (id: string) => ["vendors", id] as const,
  },
  purchases: {
    all: ["purchases"] as const,
    lists: () => ["purchases"] as const,
    detail: (id: string) => ["purchases", id] as const,
  },
  locations: {
    all: ["locations"] as const,
    lists: () => ["locations"] as const,
    detail: (id: string) => ["locations", id] as const,
  },
  products: {
    all: ["products"] as const,
    lists: (type?: ProductType) => ["products", type] as const,
    detail: (id: string) => ["products", id] as const,
  },
  users: {
    all: ["users"] as const,
    lists: () => ["users"] as const,
    detail: (id: string) => ["users", id] as const,
  },
  userTypes: {
    all: ["user-types"] as const,
    lists: () => ["user-types"] as const,
    detail: (id: string) => ["user-types", id] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    detail: (from?: string, to?: string) => ["dashboard", from, to] as const,
  },
  saleReport: {
    all: ["sale-report"] as const,
    list: (params: object) =>
      ["sale-report", params] as const,
  },
  expenseReport: {
    all: ["expense-report"] as const,
    list: (params: object) =>
      ["expense-report", params] as const,
  },
  arbSaleReport: {
    all: ["arb-sale-report"] as const,
    list: (params: object) =>
      ["arb-sale-report", params] as const,
  },
  commercialSaleReport: {
    all: ["commercial-sale-report"] as const,
    list: (params: object) =>
      ["commercial-sale-report", params] as const,
  },
  domSaleReport: {
    all: ["dom-sale-report"] as const,
    list: (params: object) =>
      ["dom-sale-report", params] as const,
  },
  purchaseReport: {
    all: ["purchase-report"] as const,
    list: (params: object) =>
      ["purchase-report", params] as const,
  },
  saleByProductReport: {
    all: ["sale-by-product-report"] as const,
    list: (params: object) =>
      ["sale-by-product-report", params] as const,
  },
};
