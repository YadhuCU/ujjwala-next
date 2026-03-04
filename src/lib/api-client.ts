import axios from "axios";
import { Prisma } from "@prisma/client";
import type {
  Expense,
  Location,
  Product,
  Account,
  Vendor,
  ProductType,
} from "@prisma/client";

// ─── Prisma Payload Types ───────────────────────────────────────────────────
// These types match exactly what the server endpoints return, including joined relations.

export type SalePayload = Prisma.SaleGetPayload<{
  include: { stock: true; customer: true; product: true };
}>;

export type DomSalePayload = Prisma.DomSaleGetPayload<{
  include: { stock: true; product: true };
}>;

export type ArbSalePayload = Prisma.ArbSaleGetPayload<{
  include: { customer: true; items: { include: { stock: true; product: true } } };
}>;

export type StockPayload = Prisma.StockGetPayload<{
  include: { product: true; vendor: true };
}>;

export type CustomerPayload = Prisma.CustomerGetPayload<{
  include: { location: true };
}>;

export type PurchasePayload = Prisma.PurchaseGetPayload<{
  include: { vendor: true; items: { include: { product: true } } };
}>;

export type UserPayload = Omit<Account, "password">;

// ─── Axios Client Instance ──────────────────────────────────────────────────
// Single axios instance used across the app.
// Add interceptors here for auth tokens, error logging, etc.

export const apiClient = axios.create({
  baseURL: "/",
  headers: { "Content-Type": "application/json" },
});

// ─── API Functions ──────────────────────────────────────────────────────────

export const api = {
  // ─── List (GET all) ─────────────────────────────────────
  getSales: () => apiClient.get<SalePayload[]>("/api/sales").then((r) => r.data),
  getDomSales: () => apiClient.get<DomSalePayload[]>("/api/dom-sales").then((r) => r.data),
  getArbSales: () => apiClient.get<{ data: ArbSalePayload[], pagination: unknown }>("/api/arb-sales").then((r) => r.data.data),
  getExpenses: () => apiClient.get<Expense[]>("/api/expenses").then((r) => r.data),
  getCustomers: () => apiClient.get<CustomerPayload[]>("/api/customers").then((r) => r.data),
  getStocks: (type?: ProductType) => apiClient.get<StockPayload[]>("/api/stock", { params: { type } }).then((r) => r.data),
  getLocations: () => apiClient.get<Location[]>("/api/locations").then((r) => r.data),
  getProducts: (type?: ProductType) => apiClient.get<Product[]>("/api/products", { params: { type } }).then((r) => r.data),
  getUsers: () => apiClient.get<UserPayload[]>("/api/users").then((r) => r.data),
  getVendors: () => apiClient.get<Vendor[]>("/api/vendors").then((r) => r.data),
  getPurchases: () => apiClient.get<PurchasePayload[]>("/api/purchases").then((r) => r.data),

  // ─── Detail (GET by id) ─────────────────────────────────
  getById: <T>(resource: string, id: string) =>
    apiClient.get<T>(`/api/${resource}/${id}`).then((r) => r.data),

  // ─── Custom GET endpoints ───────────────────────────────
  getCustomerTxn: (custId: string) =>
    apiClient
      .get<{ rent_qty: number; pending_amount: number }>(
        `/api/customer-txn?cust_id=${custId}`
      )
      .then((r) => r.data),

  getDashboard: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiClient
      .get<Record<string, unknown>>(`/api/dashboard${qs ? `?${qs}` : ""}`)
      .then((r) => r.data);
  },

  getSaleReport: (params: {
    from: string;
    to: string;
    customerId?: string;
    staffId?: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    if (params.customerId) sp.set("customerId", params.customerId);
    if (params.staffId) sp.set("staffId", params.staffId);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiClient
      .get(`/api/reports/sales?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportSaleReport: async (params: {
    from: string;
    to: string;
    customerId?: string;
    staffId?: string;
    format: "excel" | "pdf";
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    sp.set("format", params.format);
    if (params.customerId) sp.set("customerId", params.customerId);
    if (params.staffId) sp.set("staffId", params.staffId);
    const response = await apiClient.get(
      `/api/reports/sales/export?${sp.toString()}`,
      { responseType: "blob" }
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] || `sale_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getExpenseReport: (params: {
    from: string;
    to: string;
    staffId?: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    if (params.staffId) sp.set("staffId", params.staffId);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiClient
      .get(`/api/reports/expense?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportExpenseReport: async (params: {
    from: string;
    to: string;
    staffId?: string;
    format: "excel" | "pdf";
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    sp.set("format", params.format);
    if (params.staffId) sp.set("staffId", params.staffId);
    const response = await apiClient.get(
      `/api/reports/expense/export?${sp.toString()}`,
      { responseType: "blob" }
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] || `expense_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getArbSaleReport: (params: {
    from: string;
    to: string;
    customerId?: string;
    staffId?: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    if (params.customerId) sp.set("customerId", params.customerId);
    if (params.staffId) sp.set("staffId", params.staffId);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiClient
      .get(`/api/reports/arb-sale?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportArbSaleReport: async (params: {
    from: string;
    to: string;
    customerId?: string;
    staffId?: string;
    format: "excel" | "pdf";
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    sp.set("format", params.format);
    if (params.customerId) sp.set("customerId", params.customerId);
    if (params.staffId) sp.set("staffId", params.staffId);
    const response = await apiClient.get(
      `/api/reports/arb-sale/export?${sp.toString()}`,
      { responseType: "blob" }
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] || `arb_sale_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getPurchaseReport: (params: {
    from: string;
    to: string;
    vendorId?: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    if (params.vendorId) sp.set("vendorId", params.vendorId);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiClient
      .get(`/api/reports/purchase?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportPurchaseReport: async (params: {
    from: string;
    to: string;
    vendorId?: string;
    format: "excel" | "pdf";
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    sp.set("format", params.format);
    if (params.vendorId) sp.set("vendorId", params.vendorId);
    const response = await apiClient.get(
      `/api/reports/purchase/export?${sp.toString()}`,
      { responseType: "blob" }
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] || `purchase_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getSaleByProductReport: (params: {
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiClient
      .get(`/api/reports/sale-by-product?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportSaleByProductReport: async (params: {
    from: string;
    to: string;
    format: "excel" | "pdf";
  }) => {
    const sp = new URLSearchParams();
    sp.set("from", params.from);
    sp.set("to", params.to);
    sp.set("format", params.format);
    const response = await apiClient.get(
      `/api/reports/sale-by-product/export?${sp.toString()}`,
      { responseType: "blob" }
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] || `sale_by_product_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ─── Mutations ──────────────────────────────────────────
  create: <T>(url: string, data: T) =>
    apiClient.post(url, data).then((r) => r.data),

  update: <T>(url: string, data: T) =>
    apiClient.put(url, data).then((r) => r.data),

  patch: <T>(url: string, data: T) =>
    apiClient.patch(url, data).then((r) => r.data),

  remove: (url: string) => apiClient.delete(url).then((r) => r.data),
};
