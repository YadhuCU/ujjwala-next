import { Prisma, ProductType } from "@/generated/client";
import axios from "axios";
import { ProductResponse } from "../module/product/product.serializer";
import { ApiResponse } from "./response";
import { VendorResponse } from "../module/vendor/vendor.serializer";
import { CustomerResponse } from "@/module/customer/customer.serializer";
import { LocationResponse } from "@/module/location/location.serializer";
import { PurchaseResponse } from "@/module/purchase/purchase.serializer";
import { DomSaleResponse } from "@/module/dom-sale/dom-sale.serializer";

/** Someone the office can record a domestic round for. */
export type DomSaleFieldStaff = {
  id: number;
  name: string | null;
  username: string;
};
import {
  CustomerSummaryResponse,
  LedgerEntryResponse,
} from "@/module/customer-txn/customer-txn.serializer";
import { ArbSaleResponse } from "@/module/arb-sale/arb-sale.serializer";
import { CommercialSaleResponse } from "@/module/commercial-sale/commercial-sale.serializer";
import { ExpenseResponse } from "@/module/expense/expense.serializer";
import { UserResponse } from "@/module/user/user.serializer";
import { StockResponse } from "@/module/stock/stock.serializer";
import { StockAdjustmentResponse } from "@/module/stock-adjustment/stock-adjustment.serializer";
import { GodownStatusResponse } from "@/module/godown/godown.service";
import type {
  CommercialAlertsResponse,
  CylinderPositionResponse,
  DashboardResponse,
} from "@/module/dashboard/dashboard.service";
import { MovementResponse } from "@/module/godown/godown.serializer";
import { RoleResponse } from "@/module/role/role.serializer";
import { RbacAuditResponse } from "@/module/role/rbac-audit.serializer";
import type { PermissionMeta } from "@/lib/permissions";

/** Slim role record for the user form's picker. */
export type RoleOption = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
};

/** The permission catalogue, grouped for the role editor's matrix. */
export type PermissionGroup = { module: string; permissions: PermissionMeta[] };
import {
  ExpenseReportResponse,
  PurchaseReportResponse,
  CustomerWiseResponse,
  ProductWiseResponse,
  SaleReportResponse,
} from "@/module/report/report.serializer";

// ─── Prisma Payload Types ───────────────────────────────────────────────────
// These types match exactly what the server endpoints return, including joined relations.

export type DomSalePayload = Prisma.DomSaleGetPayload<{
  include: {
    customer: true;
    items: { include: { stock: true; product: true } };
  };
}>;

export type ArbSalePayload = Prisma.ArbSaleGetPayload<{
  include: {
    customer: true;
    items: { include: { stock: true; product: true } };
  };
}>;

export type CommercialSalePayload = Prisma.CommercialSaleGetPayload<{
  include: {
    customer: true;
    items: { include: { stock: true; product: true } };
  };
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



// ─── Axios Client Instance ──────────────────────────────────────────────────
// Single axios instance used across the app.
// Add interceptors here for auth tokens, error logging, etc.

export const apiClient = axios.create({
  baseURL: "/",
  headers: { "Content-Type": "application/json" },
});

/** Fetches a report export and hands it to the browser as a download. */
async function downloadReport(
  path: string,
  params: URLSearchParams,
  fallbackBase: string,
  format: "excel" | "pdf",
) {
  const response = await apiClient.get(`${path}?${params.toString()}`, {
    responseType: "blob",
  });
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename =
    match?.[1] || `${fallbackBase}.${format === "excel" ? "csv" : "txt"}`;
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── API Functions ──────────────────────────────────────────────────────────

export const api = {
  // ─── List (GET all) ─────────────────────────────────────
  getDomSales: () =>
    apiClient
      .get<ApiResponse<DomSaleResponse[]>>("/api/dom-sales")
      .then((r) => r.data),
  getDomSaleFieldStaff: () =>
    apiClient
      .get<ApiResponse<DomSaleFieldStaff[]>>("/api/dom-sales/field-staff")
      .then((r) => r.data),
  getArbSales: () =>
    apiClient
      .get<ApiResponse<ArbSaleResponse[]>>("/api/arb-sales")
      .then((r) => r.data),
  getCommercialSales: () =>
    apiClient
      .get<ApiResponse<CommercialSaleResponse[]>>("/api/commercial-sales")
      .then((r) => r.data),
  getExpenses: () =>
    apiClient
      .get<ApiResponse<ExpenseResponse[]>>("/api/expenses")
      .then((r) => r.data),
  getCustomers: () =>
    apiClient
      .get<ApiResponse<CustomerResponse[]>>("/api/customers")
      .then((r) => r.data),
  getStocks: (params?: { type?: ProductType; includeEmpty?: boolean }) =>
    apiClient
      .get<ApiResponse<StockResponse[]>>("/api/stock", { params })
      .then((r) => r.data),
  getLocations: () =>
    apiClient
      .get<ApiResponse<LocationResponse[]>>("/api/locations")
      .then((r) => r.data),
  getProducts: (type?: ProductType) =>
    apiClient
      .get<
        ApiResponse<ProductResponse[]>
      >("/api/products", { params: { type } })
      .then((r) => r.data),
  getUsers: () =>
    apiClient.get<ApiResponse<UserResponse[]>>("/api/users").then((r) => r.data),
  getVendors: () =>
    apiClient
      .get<ApiResponse<VendorResponse[]>>("/api/vendors")
      .then((r) => r.data),
  getPurchases: () =>
    apiClient
      .get<ApiResponse<PurchaseResponse[]>>("/api/purchases")
      .then((r) => r.data),
  getGodownStatus: () =>
    apiClient
      .get<ApiResponse<GodownStatusResponse>>("/api/godown")
      .then((r) => r.data),

  getGodownMovements: (params?: {
    productId?: number;
    txnType?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient
      .get<
        ApiResponse<MovementResponse[]>
      >("/api/godown/movements", { params })
      .then((r) => r.data),

  getStockAdjustments: () =>
    apiClient
      .get<ApiResponse<StockAdjustmentResponse[]>>("/api/stock-adjustments")
      .then((r) => r.data),
  // Full role records, paginated — the roles admin screen.
  getRoles: (params?: object) =>
    apiClient
      .get<ApiResponse<RoleResponse[]>>("/api/roles", { params })
      .then((r) => r.data),

  // Just id + name, for the user form's role picker.
  getRoleOptions: () =>
    apiClient
      .get<
        ApiResponse<RoleOption[]>
      >("/api/roles", { params: { options: true } })
      .then((r) => r.data),

  getRbacAudit: (params?: object) =>
    apiClient
      .get<ApiResponse<RbacAuditResponse[]>>("/api/roles/audit", { params })
      .then((r) => r.data),

  getPermissionCatalogue: () =>
    apiClient
      .get<ApiResponse<PermissionGroup[]>>("/api/permissions")
      .then((r) => r.data),

  // ─── Detail (GET by id) ─────────────────────────────────
  getById: <T>(resource: string, id: string) =>
    apiClient.get<ApiResponse<T>>(`/api/${resource}/${id}`).then((r) => r.data),

  // ─── Custom GET endpoints ───────────────────────────────
  getCustomerTxnSummary: (customerId: string) =>
    apiClient
      .get<
        ApiResponse<CustomerSummaryResponse>
      >(`/api/customer-txn/${customerId}/balance`)
      .then((r) => r.data),

  getCustomerTransactions: (
    customerId: string,
    params?: { entryType?: string; page?: number; limit?: number },
  ) =>
    apiClient
      .get<
        ApiResponse<LedgerEntryResponse[]>
      >(`/api/customer-txn/${customerId}/transactions`, { params })
      .then((r) => r.data),

  getDashboard: (params: { view: string; from?: string; to?: string }) =>
    apiClient
      .get<DashboardResponse>("/api/dashboard", { params })
      .then((r) => r.data),

  getDashboardCylinders: () =>
    apiClient
      .get<CylinderPositionResponse>("/api/dashboard/cylinders")
      .then((r) => r.data),

  getDashboardAlerts: (params: { cylinderDays: number; paymentDays: number }) =>
    apiClient
      .get<CommercialAlertsResponse>("/api/dashboard/alerts", { params })
      .then((r) => r.data),

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
      .get<ExpenseReportResponse>(`/api/reports/expense?${sp.toString()}`)
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
      { responseType: "blob" },
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] ||
      `expense_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
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
      .get<SaleReportResponse>(`/api/reports/arb-sale?${sp.toString()}`)
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
      { responseType: "blob" },
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] ||
      `arb_sale_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getCommercialSaleReport: (params: {
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
      .get<SaleReportResponse>(`/api/reports/commercial-sale?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportCommercialSaleReport: async (params: {
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
      `/api/reports/commercial-sale/export?${sp.toString()}`,
      { responseType: "blob" },
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] ||
      `commercial_sale_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getDomSaleReport: (params: {
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
      .get<SaleReportResponse>(`/api/reports/dom-sale?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportDomSaleReport: async (params: {
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
      `/api/reports/dom-sale/export?${sp.toString()}`,
      { responseType: "blob" },
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] ||
      `dom_sale_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
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
      .get<PurchaseReportResponse>(`/api/reports/purchase?${sp.toString()}`)
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
      { responseType: "blob" },
    );
    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fallbackExt = params.format === "excel" ? "csv" : "txt";
    const filename =
      match?.[1] ||
      `purchase_report_${new Date().toISOString().split("T")[0]}.${fallbackExt}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getProductWiseReport: (params: { from: string; to: string }) => {
    const sp = new URLSearchParams({ from: params.from, to: params.to });
    return apiClient
      .get<ProductWiseResponse>(`/api/reports/product-wise?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportProductWiseReport: (params: {
    from: string;
    to: string;
    format: "excel" | "pdf";
  }) =>
    downloadReport(
      "/api/reports/product-wise/export",
      new URLSearchParams(params),
      "product_wise_report",
      params.format,
    ),

  getCustomerWiseReport: (params: {
    from: string;
    to: string;
    customerId?: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams({ from: params.from, to: params.to });
    if (params.customerId) sp.set("customerId", params.customerId);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiClient
      .get<CustomerWiseResponse>(`/api/reports/customer-wise?${sp.toString()}`)
      .then((r) => r.data);
  },

  exportCustomerWiseReport: (params: {
    from: string;
    to: string;
    customerId?: string;
    format: "excel" | "pdf";
  }) => {
    const sp = new URLSearchParams({
      from: params.from,
      to: params.to,
      format: params.format,
    });
    if (params.customerId) sp.set("customerId", params.customerId);
    return downloadReport(
      "/api/reports/customer-wise/export",
      sp,
      "customer_wise_report",
      params.format,
    );
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
