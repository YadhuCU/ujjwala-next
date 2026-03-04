"use client";

import { useState, useEffect } from "react";
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
import { useStocks } from "@/hooks/use-api";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const domSaleSchema = z.object({
  stockId: z.string().min(1, "Stock is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  salePrice: z.number().min(0).optional(),
  collectionAmount: z.number().min(0),
});

export type DomSaleFormValues = z.infer<typeof domSaleSchema>;

import { StockPayload as Stock } from "@/lib/api-client";

// ─── Props ───────────────────────────────────────────────────────────────────

interface DomSaleFormProps {
  defaultValues?: DomSaleFormValues;
  isEditMode?: boolean;
  onSubmit: (values: DomSaleFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DomSaleForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: DomSaleFormProps) {
  const { data: rawStocks = [] } = useStocks("Domestic");
  const stocks = rawStocks as Stock[];
  const [availableQty, setAvailableQty] = useState<number | null>(null);

  const form = useForm<DomSaleFormValues>({
    resolver: zodResolver(domSaleSchema),
    defaultValues: defaultValues ?? {
      stockId: "",
      quantity: 1,
      salePrice: 0,
      collectionAmount: 0,
    },
  });

  const selectedStockId = form.watch("stockId");

  useEffect(() => {
    if (selectedStockId) {
      const selected = stocks.find((s) => String(s.id) === selectedStockId);
      if (selected) {
        form.setValue("salePrice", Number(selected.product?.salePrice) || 0);
        setAvailableQty(selected.quantity ?? null);
      }
    } else {
      setAvailableQty(null);
    }
  }, [selectedStockId, stocks, form]);

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>Sale Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid lg:grid-cols-2 gap-4 items-start"
          >
            <FormField
              control={form.control}
              name="stockId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select stock" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stocks.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.product?.name || s.batchNo} — {s.batchNo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableQty !== null && (
                    <p className="text-sm text-muted-foreground">
                      Available: {availableQty}
                    </p>
                  )}
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
              name="salePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Price</FormLabel>
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
            <FormField
              control={form.control}
              name="collectionAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection Amount</FormLabel>
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
