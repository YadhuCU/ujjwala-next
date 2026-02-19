// ─── Query Key Factory ──────────────────────────────────────────────────────
// Centralized query keys for TanStack Query.
// Each entity provides: .all (for invalidation), .lists() (for list queries),
// and .detail(id) (for single-item queries).

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
    lists: () => ["stocks"] as const,
    detail: (id: string) => ["stocks", id] as const,
  },
  locations: {
    all: ["locations"] as const,
    lists: () => ["locations"] as const,
    detail: (id: string) => ["locations", id] as const,
  },
  products: {
    all: ["products"] as const,
    lists: () => ["products"] as const,
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
};
