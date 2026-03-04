import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ProductType } from "@prisma/client";

// ─── Query Options (single-use, consumed inline via useQuery) ────────────────

export const salesOptions = queryOptions({
  queryKey: queryKeys.sales.lists(),
  queryFn: api.getSales,
});

export const domSalesOptions = queryOptions({
  queryKey: queryKeys.domSales.lists(),
  queryFn: api.getDomSales,
});

export const arbSalesOptions = queryOptions({
  queryKey: queryKeys.arbSales.lists(),
  queryFn: api.getArbSales,
});

export const expensesOptions = queryOptions({
  queryKey: queryKeys.expenses.lists(),
  queryFn: api.getExpenses,
});

export const customerTxnOptions = (custId: string) =>
  queryOptions({
    queryKey: queryKeys.customerTxn.detail(custId),
    queryFn: () => api.getCustomerTxn(custId),
    enabled: !!custId,
  });

export const dashboardOptions = (from?: string, to?: string) =>
  queryOptions({
    queryKey: queryKeys.dashboard.detail(from, to),
    queryFn: () => api.getDashboard(from, to),
  });

// ─── Reusable Query Options (used in custom hooks) ──────────────────────────

export const stocksOptions = (type?: ProductType) =>
  queryOptions({
    queryKey: queryKeys.stocks.lists(type),
    queryFn: () => api.getStocks(type),
  });

export const customersOptions = queryOptions({
  queryKey: queryKeys.customers.lists(),
  queryFn: api.getCustomers,
});

export const locationsOptions = queryOptions({
  queryKey: queryKeys.locations.lists(),
  queryFn: api.getLocations,
});

export const productsOptions = (type?: ProductType) =>
  queryOptions({
    queryKey: queryKeys.products.lists(type),
    queryFn: () => api.getProducts(type),
  });

export const usersOptions = queryOptions({
  queryKey: queryKeys.users.lists(),
  queryFn: api.getUsers,
});

export const vendorsOptions = queryOptions({
  queryKey: queryKeys.vendors.lists(),
  queryFn: api.getVendors,
});

export const purchasesOptions = queryOptions({
  queryKey: queryKeys.purchases.lists(),
  queryFn: api.getPurchases,
});

