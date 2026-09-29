"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsOptions } from "@/lib/query-options";
import {
  StockAdjustmentFormSchema,
  StockAdjustmentFormValues,
} from "@/module/stock-adjustment/stock-adjustment.form.schema";

interface StockAdjustmentFormProps {
  onSubmit: (values: StockAdjustmentFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StockAdjustmentForm({
  onSubmit,
  isPending,
}: StockAdjustmentFormProps) {
  const { data: products } = useSuspenseQuery(productsOptions());

  const form = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(
      StockAdjustmentFormSchema,
    ) as Resolver<StockAdjustmentFormValues>,
    defaultValues: { filledDelta: 0, emptyDelta: 0, reason: "" },
  });

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>New Stock Adjustment</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start"
          >
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem className="lg:col-span-2">
                  <FormLabel>Product</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="filledDelta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Filled Cylinders</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.valueAsNumber || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Positive adds to the godown, negative removes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emptyDelta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empty Cylinders</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.valueAsNumber || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Positive adds to the godown, negative removes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem className="lg:col-span-2">
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="e.g. Physical count found 2 fewer 14.2 kg cylinders"
                    />
                  </FormControl>
                  <FormDescription>
                    Free text on purpose — an adjustment is permanent and this is
                    the only record of why it happened.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3 sm:flex lg:col-span-2">
              <Button type="submit" isLoading={isPending}>
                Post Adjustment
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
