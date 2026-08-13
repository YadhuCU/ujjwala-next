import { CommercialSaleType, PaymentType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (value: string) =>
  value.trim() === "" ? undefined : value;

export const CommercialSaleItemFormSchema = z.object({
  stockId: z.number("Select a stock").int(),

  saleType: z.enum(CommercialSaleType, "Select rent or sale"),

  quantity: z.coerce.number().int().min(1, "Quantity must be greater than 0"),

  salePrice: z.coerce.number().min(0, "Sale price cannot be negative"),
});

export const CommercialSaleFormSchema = z.object({
  customerId: z.number("Customer is required").int("Customer is required"),

  invoiceDate: z.date("Invoice date is required"),

  paymentType: z.enum(PaymentType, "Payment type is required"),

  paidAmount: z.coerce
    .number()
    .min(0, "Paid amount cannot be negative")
    .default(0),

  discount: z.coerce.number().min(0, "Discount cannot be negative").optional(),

  notes: z
    .string()
    .transform((v) => emptyToUndefined(v))
    .optional(),

  items: z.array(CommercialSaleItemFormSchema),
});

export type CommercialSaleFormValues = z.infer<typeof CommercialSaleFormSchema>;

/* ---------- Cylinder return (separate business event) ---------- */

export const CylinderReturnFormSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int(),
        returnQty: z.coerce
          .number()
          .int()
          .min(0, "Return quantity cannot be negative"),
      }),
    )
    .min(1, "Nothing to return"),
});

export type CylinderReturnFormValues = z.infer<typeof CylinderReturnFormSchema>;
