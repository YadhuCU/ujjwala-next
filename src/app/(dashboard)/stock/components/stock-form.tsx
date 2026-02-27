"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useProducts } from "@/hooks/use-api";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const stockSchema = z.object({
  batchNo: z.string().min(1, "Batch number is required"),
  productId: z.string().optional().or(z.literal("")),
  invoiceNo: z.string().optional().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity is required"),
  productCost: z.number().min(0).optional(),
});

export type StockFormValues = z.infer<typeof stockSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string | null;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface StockFormProps {
  defaultValues?: StockFormValues;
  isEditMode?: boolean;
  onSubmit: (values: StockFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StockForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: StockFormProps) {
  const { data: rawProducts = [] } = useProducts();
  const products = rawProducts as Product[];

  const form = useForm<StockFormValues>({
    resolver: zodResolver(stockSchema),
    defaultValues: defaultValues ?? {
      batchNo: "",
      productId: "",
      invoiceNo: "",
      quantity: 0,
      productCost: 0,
    },
  });

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>Stock Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 lg:grid-cols-2 items-start"
          >
            <FormField
              control={form.control}
              name="batchNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch No</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
              name="invoiceNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice No</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
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
            <FormField
              control={form.control}
              name="productCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Cost</FormLabel>
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
            <div className="flex gap-3 pt-2">
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
