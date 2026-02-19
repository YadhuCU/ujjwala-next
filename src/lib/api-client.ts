import axios from "axios";

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
  getSales: () => apiClient.get<unknown[]>("/api/sales").then((r) => r.data),
  getDomSales: () => apiClient.get<unknown[]>("/api/dom-sales").then((r) => r.data),
  getExpenses: () => apiClient.get<unknown[]>("/api/expenses").then((r) => r.data),
  getCustomers: () => apiClient.get<unknown[]>("/api/customers").then((r) => r.data),
  getStocks: () => apiClient.get<unknown[]>("/api/stock").then((r) => r.data),
  getLocations: () => apiClient.get<unknown[]>("/api/locations").then((r) => r.data),
  getProducts: () => apiClient.get<unknown[]>("/api/products").then((r) => r.data),
  getUsers: () => apiClient.get<unknown[]>("/api/users").then((r) => r.data),
  getUserTypes: () => apiClient.get<unknown[]>("/api/user-types").then((r) => r.data),

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

  // ─── Mutations ──────────────────────────────────────────
  create: <T>(url: string, data: T) =>
    apiClient.post(url, data).then((r) => r.data),

  update: <T>(url: string, data: T) =>
    apiClient.put(url, data).then((r) => r.data),

  patch: <T>(url: string, data: T) =>
    apiClient.patch(url, data).then((r) => r.data),

  remove: (url: string) => apiClient.delete(url).then((r) => r.data),
};
