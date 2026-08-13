import { z } from "zod";

export const ExpenseFormSchema = z.object({
  expense: z
    .string("Expense is required")
    .trim()
    .min(1, "Expense is required")
    .max(100, "Expense cannot exceed 100 characters"),

  date: z.date("Date is required"),

  amount: z.coerce
    .number("Amount is required")
    .min(0, "Amount cannot be negative"),
});

export type ExpenseFormValues = z.infer<typeof ExpenseFormSchema>;
