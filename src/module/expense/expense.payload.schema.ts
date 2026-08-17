import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const ExpensePayloadSchema = z.object({
  expense: z.string().trim().min(1).max(100),
  date: z.coerce.date(),
  amount: z.number().min(0),
});

const roundAmount = (data: z.infer<typeof ExpensePayloadSchema>) => ({
  ...data,
  amount: Math.round(data.amount * 100) / 100,
});

export const CreateExpenseSchema = ExpensePayloadSchema.transform(roundAmount);
export const UpdateExpenseSchema = ExpensePayloadSchema.transform(roundAmount);

export const ExpenseQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;
