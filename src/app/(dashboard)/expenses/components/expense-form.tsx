"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const expenseSchema = z.object({
  expense: z.string().min(1, "Expense description is required"),
  date: z.string().min(1, "Date is required"),
  amount: z.number().min(0, "Amount must be 0 or more"),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  defaultValues?: ExpenseFormValues;
  isEditMode?: boolean;
  onSubmit: (values: ExpenseFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExpenseForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: ExpenseFormProps) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaultValues ?? {
      expense: "",
      date: new Date().toISOString().split("T")[0],
      amount: 0,
    },
  });

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>Expense Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid lg:grid-cols-2 gap-4 items-start"
          >
            <FormField
              control={form.control}
              name="expense"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.valueAsNumber || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3 pt-2 lg:col-span-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditMode ? "Update" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
