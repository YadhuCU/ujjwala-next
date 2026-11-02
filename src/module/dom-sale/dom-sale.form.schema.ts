import { CommercialSaleType, PaymentType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (value: string) =>
  value.trim() === "" ? undefined : value;

export const DomSaleItemFormSchema = z.object({
  stockId: z.number("Select a stock").int(),

  quantity: z.coerce.number().int().min(1, "Quantity must be greater than 0"),

  salePrice: z.coerce.number().min(0, "Sale price cannot be negative"),

  // RENT is a refill: a full out, the house's empty back. SALE is outright.
  saleType: z
    .enum(CommercialSaleType, "Select rent or sale")
    .default(CommercialSaleType.SALE),

  // Filled in with the quantity on a refill; lower it if a house had no empty.
  emptiesCollected: z.coerce
    .number()
    .int()
    .min(0, "Cannot be negative")
    .default(0),
}).refine((item) => item.emptiesCollected <= item.quantity, {
  message: "More than were handed out",
  path: ["emptiesCollected"],
});

// A field staff member's round: no customer, and paid in full at each door.
export const DomSaleFormSchema = z.object({
  // Only shown to the office. A field staff member's own sales are recorded as
  // theirs by the server, so they never send it.
  fieldStaffId: z.number("Select the field staff").int().optional(),

  paymentType: z.enum(PaymentType, "Payment type is required"),

  discount: z.coerce.number().min(0, "Discount cannot be negative").optional(),

  notes: z
    .string()
    .transform((v) => emptyToUndefined(v))
    .optional(),

  items: z.array(DomSaleItemFormSchema),
});

export type DomSaleFormValues = z.infer<typeof DomSaleFormSchema>;
