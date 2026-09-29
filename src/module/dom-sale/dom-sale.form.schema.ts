import { CommercialSaleType, PaymentType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (value: string) =>
  value.trim() === "" ? undefined : value;

export const DomSaleItemFormSchema = z.object({
  stockId: z.number("Select a stock").int(),

  quantity: z.coerce.number().int().min(1, "Quantity must be greater than 0"),

  salePrice: z.coerce.number().min(0, "Sale price cannot be negative"),

  // RENT is a refill: a full out, the customer's empty back. SALE is outright.
  saleType: z
    .enum(CommercialSaleType, "Select rent or sale")
    .default(CommercialSaleType.SALE),

  // Filled in with the quantity on a refill; edit it if more or fewer came back.
  emptiesCollected: z.coerce
    .number()
    .int()
    .min(0, "Cannot be negative")
    .default(0),
});

export const DomSaleFormSchema = z.object({
  customerId: z.number("Customer is required").int("Customer is required"),

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

  items: z.array(DomSaleItemFormSchema),
});

export type DomSaleFormValues = z.infer<typeof DomSaleFormSchema>;
