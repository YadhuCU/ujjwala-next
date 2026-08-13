import { z } from "zod";
import { PaymentType } from "@/generated/enums";

const emptyToUndefined = (value: string) =>
  value.trim() === "" ? undefined : value;

export const RecordPaymentFormSchema = z.object({
  amount: z.coerce
    .number("Amount is required")
    .positive("Amount must be greater than 0"),

  paymentMethod: z.enum(PaymentType, "Payment method is required"),

  notes: z
    .string()
    .transform((v) => emptyToUndefined(v))
    .optional(),
});

export type RecordPaymentFormValues = z.infer<typeof RecordPaymentFormSchema>;
