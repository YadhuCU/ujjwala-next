/**
 * The permission catalogue.
 *
 * `PERMISSIONS` is the source of truth for permission *codes* — the strings
 * stored in `permissions.code` and checked by `withAuth` on every route. Codes
 * are defined here rather than created from the admin UI because a permission
 * only means something if some route checks it; a hand-typed code would be an
 * empty promise.
 *
 * `PERMISSION_REGISTRY` adds the human-facing metadata the role editor needs to
 * render its matrix. Every code must appear in it exactly once — enforced by
 * `permissions.test.ts`, so a new permission cannot be added without also
 * becoming manageable.
 */

export const PERMISSIONS = {
  USER_CREATE: "user.create",
  USER_READ: "user.read",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",

  ROLE_CREATE: "role.create",
  ROLE_READ: "role.read",
  ROLE_UPDATE: "role.update",
  ROLE_DELETE: "role.delete",

  STOCK_CREATE: "stock.create",
  STOCK_READ: "stock.read",
  STOCK_UPDATE: "stock.update",
  STOCK_DELETE: "stock.delete",

  PRODUCT_CREATE: "product.create",
  PRODUCT_READ: "product.read",
  PRODUCT_UPDATE: "product.update",
  PRODUCT_DELETE: "product.delete",

  PURCHASE_CREATE: "purchase.create",
  PURCHASE_READ: "purchase.read",
  PURCHASE_UPDATE: "purchase.update",
  PURCHASE_DELETE: "purchase.delete",

  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_READ: "customer.read",
  CUSTOMER_UPDATE: "customer.update",
  CUSTOMER_DELETE: "customer.delete",

  VENDOR_CREATE: "vendor.create",
  VENDOR_READ: "vendor.read",
  VENDOR_UPDATE: "vendor.update",
  VENDOR_DELETE: "vendor.delete",

  LOCATION_CREATE: "location.create",
  LOCATION_READ: "location.read",
  LOCATION_UPDATE: "location.update",
  LOCATION_DELETE: "location.delete",

  // Expense is author-private: the .own / .all pair below decides whose rows a
  // role can see. `expense.read` is the gate for opening the module at all.
  EXPENSE_CREATE: "expense.create",
  EXPENSE_READ: "expense.read",
  EXPENSE_READ_ALL: "expense.read.all",
  EXPENSE_READ_OWN: "expense.read.own",
  EXPENSE_UPDATE: "expense.update",
  EXPENSE_DELETE: "expense.delete",

  COMMERCIAL_SALE_CREATE: "commercial_sale.create",
  COMMERCIAL_SALE_READ: "commercial_sale.read",
  COMMERCIAL_SALE_UPDATE: "commercial_sale.update",
  COMMERCIAL_SALE_DELETE: "commercial_sale.delete",

  DOMESTIC_SALE_CREATE: "domestic_sale.create",
  DOMESTIC_SALE_READ: "domestic_sale.read",
  DOMESTIC_SALE_UPDATE: "domestic_sale.update",
  DOMESTIC_SALE_DELETE: "domestic_sale.delete",

  ARB_SALE_CREATE: "arb_sale.create",
  ARB_SALE_READ: "arb_sale.read",
  ARB_SALE_UPDATE: "arb_sale.update",
  ARB_SALE_DELETE: "arb_sale.delete",

  REPORT_READ: "report.read",
  REPORT_READ_ALL: "report.read.all",
  REPORT_READ_OWN: "report.read.own",
  REPORT_EXPORT: "report.export",

  DASHBOARD_READ: "dashboard.read",
  DASHBOARD_READ_ALL: "dashboard.read.all",
  DASHBOARD_READ_OWN: "dashboard.read.own",
  DASHBOARD_FINANCIALS: "dashboard.financials",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role *names*, not permissions. Only used where the OWNER role is structurally
// special: it is the system role that can never be edited away, which is what
// makes a lockout recoverable. Authorization decisions must use permissions.
export const ROLES = {
  OWNER: "OWNER",
  OFFICE_STAFF: "OFFICE_STAFF",
  FIELD_STAFF: "FIELD_STAFF",
} as const;

// =============================================================================
// SCOPE PAIRS
// A module whose rows belong to whoever recorded them. `resolveScope` in
// `access-scope.ts` turns one of these into "all" | "own" | "none".
// =============================================================================

export const SCOPES = {
  EXPENSE: {
    all: PERMISSIONS.EXPENSE_READ_ALL,
    own: PERMISSIONS.EXPENSE_READ_OWN,
  },
  REPORT: {
    all: PERMISSIONS.REPORT_READ_ALL,
    own: PERMISSIONS.REPORT_READ_OWN,
  },
  DASHBOARD: {
    all: PERMISSIONS.DASHBOARD_READ_ALL,
    own: PERMISSIONS.DASHBOARD_READ_OWN,
  },
} as const;

// =============================================================================
// REGISTRY
// =============================================================================

export type PermissionMeta = {
  code: Permission;
  module: string;
  label: string;
  description?: string;
};

const crud = (
  module: string,
  noun: string,
  codes: {
    create: Permission;
    read: Permission;
    update: Permission;
    delete: Permission;
  },
): PermissionMeta[] => [
  { code: codes.read, module, label: `View ${noun}` },
  { code: codes.create, module, label: `Add ${noun}` },
  { code: codes.update, module, label: `Edit ${noun}` },
  { code: codes.delete, module, label: `Delete ${noun}` },
];

export const PERMISSION_REGISTRY: PermissionMeta[] = [
  ...crud("Users", "users", {
    create: PERMISSIONS.USER_CREATE,
    read: PERMISSIONS.USER_READ,
    update: PERMISSIONS.USER_UPDATE,
    delete: PERMISSIONS.USER_DELETE,
  }),

  ...crud("Roles & permissions", "roles", {
    create: PERMISSIONS.ROLE_CREATE,
    read: PERMISSIONS.ROLE_READ,
    update: PERMISSIONS.ROLE_UPDATE,
    delete: PERMISSIONS.ROLE_DELETE,
  }),

  ...crud("Customers", "customers", {
    create: PERMISSIONS.CUSTOMER_CREATE,
    read: PERMISSIONS.CUSTOMER_READ,
    update: PERMISSIONS.CUSTOMER_UPDATE,
    delete: PERMISSIONS.CUSTOMER_DELETE,
  }),

  ...crud("Products", "products", {
    create: PERMISSIONS.PRODUCT_CREATE,
    read: PERMISSIONS.PRODUCT_READ,
    update: PERMISSIONS.PRODUCT_UPDATE,
    delete: PERMISSIONS.PRODUCT_DELETE,
  }),

  ...crud("Vendors", "vendors", {
    create: PERMISSIONS.VENDOR_CREATE,
    read: PERMISSIONS.VENDOR_READ,
    update: PERMISSIONS.VENDOR_UPDATE,
    delete: PERMISSIONS.VENDOR_DELETE,
  }),

  ...crud("Locations", "locations", {
    create: PERMISSIONS.LOCATION_CREATE,
    read: PERMISSIONS.LOCATION_READ,
    update: PERMISSIONS.LOCATION_UPDATE,
    delete: PERMISSIONS.LOCATION_DELETE,
  }),

  // Stock read also opens the godown and the stock-adjustment log; posting an
  // adjustment is gated on stock.update.
  ...crud("Stock & godown", "stock", {
    create: PERMISSIONS.STOCK_CREATE,
    read: PERMISSIONS.STOCK_READ,
    update: PERMISSIONS.STOCK_UPDATE,
    delete: PERMISSIONS.STOCK_DELETE,
  }),

  ...crud("Purchases", "purchases", {
    create: PERMISSIONS.PURCHASE_CREATE,
    read: PERMISSIONS.PURCHASE_READ,
    update: PERMISSIONS.PURCHASE_UPDATE,
    delete: PERMISSIONS.PURCHASE_DELETE,
  }),

  ...crud("Commercial sales", "commercial sales", {
    create: PERMISSIONS.COMMERCIAL_SALE_CREATE,
    read: PERMISSIONS.COMMERCIAL_SALE_READ,
    update: PERMISSIONS.COMMERCIAL_SALE_UPDATE,
    delete: PERMISSIONS.COMMERCIAL_SALE_DELETE,
  }),

  ...crud("Domestic sales", "domestic sales", {
    create: PERMISSIONS.DOMESTIC_SALE_CREATE,
    read: PERMISSIONS.DOMESTIC_SALE_READ,
    update: PERMISSIONS.DOMESTIC_SALE_UPDATE,
    delete: PERMISSIONS.DOMESTIC_SALE_DELETE,
  }),

  ...crud("ARB sales", "ARB sales", {
    create: PERMISSIONS.ARB_SALE_CREATE,
    read: PERMISSIONS.ARB_SALE_READ,
    update: PERMISSIONS.ARB_SALE_UPDATE,
    delete: PERMISSIONS.ARB_SALE_DELETE,
  }),

  {
    code: PERMISSIONS.EXPENSE_READ,
    module: "Expenses",
    label: "Open expenses",
    description: "Required to reach the module at all.",
  },
  {
    code: PERMISSIONS.EXPENSE_READ_OWN,
    module: "Expenses",
    label: "See own expenses only",
    description: "Restricted to expenses this user recorded.",
  },
  {
    code: PERMISSIONS.EXPENSE_READ_ALL,
    module: "Expenses",
    label: "See everyone's expenses",
    description: "Overrides the own-only restriction.",
  },
  { code: PERMISSIONS.EXPENSE_CREATE, module: "Expenses", label: "Add expenses" },
  {
    code: PERMISSIONS.EXPENSE_UPDATE,
    module: "Expenses",
    label: "Edit expenses",
    description: "Still limited to what this user can see.",
  },
  {
    code: PERMISSIONS.EXPENSE_DELETE,
    module: "Expenses",
    label: "Delete expenses",
    description: "Still limited to what this user can see.",
  },

  {
    code: PERMISSIONS.REPORT_READ,
    module: "Reports",
    label: "Open reports",
    description: "Required to reach the module at all.",
  },
  {
    code: PERMISSIONS.REPORT_READ_OWN,
    module: "Reports",
    label: "Report on own records only",
    description: "Restricted to paperwork this user recorded.",
  },
  {
    code: PERMISSIONS.REPORT_READ_ALL,
    module: "Reports",
    label: "Report on the whole agency",
    description: "Also unlocks filtering by staff member.",
  },
  { code: PERMISSIONS.REPORT_EXPORT, module: "Reports", label: "Export to Excel / PDF" },

  {
    code: PERMISSIONS.DASHBOARD_READ,
    module: "Dashboard",
    label: "Open the dashboard",
    description: "Required to reach the module at all.",
  },
  {
    code: PERMISSIONS.DASHBOARD_READ_OWN,
    module: "Dashboard",
    label: "Figures from own records only",
  },
  {
    code: PERMISSIONS.DASHBOARD_READ_ALL,
    module: "Dashboard",
    label: "Agency-wide figures",
  },
  {
    code: PERMISSIONS.DASHBOARD_FINANCIALS,
    module: "Dashboard",
    label: "See revenue, profit and expense totals",
    description:
      "Without this the dashboard still shows cylinder and collection figures.",
  },
];

export const PERMISSION_MODULES: string[] = [
  ...new Set(PERMISSION_REGISTRY.map((entry) => entry.module)),
];
