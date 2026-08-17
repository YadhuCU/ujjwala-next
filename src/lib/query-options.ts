import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ProductType } from "@/generated/enums";

// ─── Query Options (single-use, consumed inline via useQuery) ────────────────

export const domSalesOptions = queryOptions({
  queryKey: queryKeys.domSales.lists(),
  queryFn: api.getDomSales,
});

export const arbSalesOptions = queryOptions({
  queryKey: queryKeys.arbSales.lists(),
  queryFn: api.getArbSales,
});

export const commercialSalesOptions = queryOptions({
  queryKey: queryKeys.commercialSales.lists(),
  queryFn: api.getCommercialSales,
  select: (res) => res.data,
});

export const expensesOptions = queryOptions({
  queryKey: queryKeys.expenses.lists(),
  queryFn: api.getExpenses,
  select: (res) => res.data,
});

export const customerTxnOptions = (custId: string) =>
  queryOptions({
    queryKey: queryKeys.customerTxn.detail(custId),
    queryFn: () => api.getCustomerTxnSummary(custId),
    select: (res) => res.data,
    enabled: !!custId,
  });

export const customerTransactionsOptions = (
  custId: string,
  params: { entryType?: string; page?: number; limit?: number } = {},
) =>
  queryOptions({
    queryKey: queryKeys.customerTxn.transactions(custId, params),
    queryFn: () => api.getCustomerTransactions(custId, params),
    enabled: !!custId,
  });

export const dashboardOptions = (from?: string, to?: string) =>
  queryOptions({
    queryKey: queryKeys.dashboard.detail(from, to),
    queryFn: () => api.getDashboard(from, to),
  });

// ─── Reusable Query Options (used in custom hooks) ──────────────────────────

export const stocksOptions = (type?: ProductType, includeEmpty = false) =>
  queryOptions({
    queryKey: queryKeys.stocks.lists(type, includeEmpty),
    queryFn: () => api.getStocks({ type, includeEmpty }),
    select: (res) => res.data,
  });

export const customersOptions = queryOptions({
  queryKey: queryKeys.customers.lists(),
  queryFn: api.getCustomers,
  select: (res) => res.data,
});

export const locationsOptions = queryOptions({
  queryKey: queryKeys.locations.lists(),
  queryFn: api.getLocations,
  select: (res) => res.data,
});

export const productsOptions = (type?: ProductType) =>
  queryOptions({
    queryKey: queryKeys.products.lists(type),
    queryFn: () => api.getProducts(type),
    select: (res) => res.data,
  });

export const usersOptions = queryOptions({
  queryKey: queryKeys.users.lists(),
  queryFn: api.getUsers,
  select: (res) => res.data,
});

export const vendorsOptions = queryOptions({
  queryKey: queryKeys.vendors.lists(),
  queryFn: api.getVendors,
  select: (res) => res.data,
});

export const purchasesOptions = queryOptions({
  queryKey: queryKeys.purchases.lists(),
  queryFn: api.getPurchases,
  select: (res) => res.data,
});

export const godownStatusOptions = queryOptions({
  queryKey: queryKeys.godown.status(),
  queryFn: api.getGodownStatus,
  select: (res) => res.data,
});

export const godownMovementsOptions = (
  params: { productId?: number; txnType?: string; limit?: number } = {},
) =>
  queryOptions({
    queryKey: queryKeys.godown.movements(params),
    queryFn: () => api.getGodownMovements(params),
    select: (res) => res.data,
  });

export const stockAdjustmentsOptions = queryOptions({
  queryKey: queryKeys.stockAdjustments.lists(),
  queryFn: api.getStockAdjustments,
  select: (res) => res.data,
});

export const rolesOptions = queryOptions({
  queryKey: queryKeys.roles.options(),
  queryFn: api.getRoleOptions,
});

export const roleListOptions = (params: object = {}) =>
  queryOptions({
    queryKey: queryKeys.roles.list(params),
    queryFn: () => api.getRoles(params),
  });

export const rbacAuditOptions = (params: object = {}) =>
  queryOptions({
    queryKey: queryKeys.roles.audit(params),
    queryFn: () => api.getRbacAudit(params),
  });

export const permissionCatalogueOptions = queryOptions({
  queryKey: queryKeys.permissions.catalogue(),
  queryFn: api.getPermissionCatalogue,
  select: (res) => res.data,
  // The catalogue only changes when the application is redeployed.
  staleTime: Infinity,
});

// ─── Reports ────────────────────────────────────────────────────────────────
// Every report is fetched only after the user hits Search, so these are always
// consumed with `enabled`.

export type SaleReportParams = {
  from: string;
  to: string;
  customerId?: string;
  staffId?: string;
  page?: number;
  limit?: number;
};

export const purchaseReportOptions = (params: {
  from: string;
  to: string;
  vendorId?: string;
  page?: number;
  limit?: number;
}) =>
  queryOptions({
    queryKey: queryKeys.purchaseReport.list(params),
    queryFn: () => api.getPurchaseReport(params),
  });

export const expenseReportOptions = (params: {
  from: string;
  to: string;
  staffId?: string;
  page?: number;
  limit?: number;
}) =>
  queryOptions({
    queryKey: queryKeys.expenseReport.list(params),
    queryFn: () => api.getExpenseReport(params),
  });

export const saleByProductReportOptions = (params: {
  from: string;
  to: string;
  page?: number;
  limit?: number;
}) =>
  queryOptions({
    queryKey: queryKeys.saleByProductReport.list(params),
    queryFn: () => api.getSaleByProductReport(params),
  });
