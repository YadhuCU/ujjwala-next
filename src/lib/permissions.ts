export const PERMISSIONS = {
  USER_CREATE: "user.create",
  USER_READ: "user.read",
  USER_READ_ALL: "user.read.all",
  USER_READ_OWN: "user.read.own",
  USER_UPDATE: "user.update",
  USER_UPDATE_ALL: "user.update.all",
  USER_UPDATE_OWN: "user.update.own",
  USER_DELETE: "user.delete",
  USER_DELETE_ALL: "user.delete.all",
  USER_DELETE_OWN: "user.delete.own",

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

  EXPENSE_CREATE: "expense.create",
  EXPENSE_READ: "expense.read",
  EXPENSE_READ_ALL: "expense.read.all",
  EXPENSE_READ_OWN: "expense.read.own",
  EXPENSE_UPDATE: "expense.update",
  EXPENSE_DELETE: "expense.delete",

  LOCATION_CREATE: "location.create",
  LOCATION_READ: "location.read",
  LOCATION_UPDATE: "location.update",
  LOCATION_DELETE: "location.delete",

  COMMERCIAL_SALE_CREATE: "commercial_sale.create",
  COMMERCIAL_SALE_READ: "commercial_sale.read",
  COMMERCIAL_SALE_READ_ALL: "commercial_sale.read.all",
  COMMERCIAL_SALE_READ_OWN: "commercial_sale.read.own",
  COMMERCIAL_SALE_UPDATE: "commercial_sale.update",
  COMMERCIAL_SALE_DELETE: "commercial_sale.delete",

  DOMESTIC_SALE_CREATE: "domestic_sale.create",
  DOMESTIC_SALE_READ: "domestic_sale.read",
  DOMESTIC_SALE_READ_ALL: "domestic_sale.read.all",
  DOMESTIC_SALE_READ_OWN: "domestic_sale.read.own",
  DOMESTIC_SALE_UPDATE: "domestic_sale.update",
  DOMESTIC_SALE_DELETE: "domestic_sale.delete",

  ARB_SALE_CREATE: "arb_sale.create",
  ARB_SALE_READ: "arb_sale.read",
  ARB_SALE_READ_ALL: "arb_sale.read.all",
  ARB_SALE_READ_OWN: "arb_sale.read.own",
  ARB_SALE_UPDATE: "arb_sale.update",
  ARB_SALE_DELETE: "arb_sale.delete",

  REPORT_READ: "report.read",
  REPORT_EXPORT: "report.export",

  DASHBOARD_READ: "dashboard.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];


export const ROLES = {
  OWNER: "OWNER",
  OFFICE_STAFF: "OFFICE_STAFF",
  FIELD_STAFF: "FIELD_STAFF",
} as const