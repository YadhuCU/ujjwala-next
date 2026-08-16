import { z } from "zod";

// "all" is what the filter dropdowns send for "no filter" — treat it as absent.
const allToUndefined = (v: unknown) => (v === "all" || v === "" ? undefined : v);

const DateRangeSchema = z.object({
  from: z.coerce.date("from date is required"),
  to: z.coerce.date("to date is required"),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const ExportFormatSchema = z.enum(["excel", "pdf"]).default("excel");

export const SaleReportQuerySchema = DateRangeSchema.extend({
  ...PaginationSchema.shape,
  customerId: z.preprocess(allToUndefined, z.coerce.number().int().optional()),
  staffId: z.preprocess(allToUndefined, z.coerce.number().int().optional()),
});

export const PurchaseReportQuerySchema = DateRangeSchema.extend({
  ...PaginationSchema.shape,
  vendorId: z.preprocess(allToUndefined, z.coerce.number().int().optional()),
  staffId: z.preprocess(allToUndefined, z.coerce.number().int().optional()),
});

export const ExpenseReportQuerySchema = DateRangeSchema.extend({
  ...PaginationSchema.shape,
  staffId: z.preprocess(allToUndefined, z.coerce.number().int().optional()),
});

export const SaleByProductQuerySchema = DateRangeSchema;

export type SaleReportQuery = z.infer<typeof SaleReportQuerySchema>;
export type PurchaseReportQuery = z.infer<typeof PurchaseReportQuerySchema>;
export type ExpenseReportQuery = z.infer<typeof ExpenseReportQuerySchema>;
export type SaleByProductQuery = z.infer<typeof SaleByProductQuerySchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
