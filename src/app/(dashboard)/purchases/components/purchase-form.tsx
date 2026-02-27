"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useProducts, useVendors } from "@/hooks/use-api";
import { Plus, Trash2 } from "lucide-react";

// ─── Schema ──────────────────────────────────────────────────────────────────

const purchaseItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  batchNo: z.string().min(1, "Batch No is required"),
  quantity: z.number().int().min(1, "Qty must be ≥ 1"),
  unitCost: z.number().min(0).optional(),
});

export const purchaseSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  invoiceNo: z.string().optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
});

export type PurchaseFormValues = z.infer<typeof purchaseSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string | null;
}

interface Vendor {
  id: number;
  name: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PurchaseFormProps {
  defaultValues?: PurchaseFormValues;
  isEditMode?: boolean;
  onSubmit: (values: PurchaseFormValues & { totalAmount: number }) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PurchaseForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: PurchaseFormProps) {
  const { data: rawProducts = [] } = useProducts();
  const products = rawProducts as Product[];
  const { data: rawVendors = [] } = useVendors();
  const vendors = rawVendors as Vendor[];

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: defaultValues ?? {
      vendorId: "",
      invoiceNo: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      notes: "",
      items: [{ productId: "", batchNo: "", quantity: 0, unitCost: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");

  /**
   * Computes grand total from all line items.
   */
  const grandTotal = watchedItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const handleSubmit = (values: PurchaseFormValues) => {
    const enrichedItems = values.items.map((item) => ({
      ...item,
      totalCost: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    }));
    onSubmit({ ...values, items: enrichedItems, totalAmount: grandTotal });
  };

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>Purchase Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* ─── Header Fields ──────────────────── */}
            <div className="grid gap-4 lg:grid-cols-2 items-start">
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.name}
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
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ─── Line Items ─────────────────────── */}
            {!isEditMode && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Items</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        productId: "",
                        batchNo: "",
                        quantity: 0,
                        unitCost: 0,
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>

                {fields.map((field, index) => {
                  const qty = Number(watchedItems[index]?.quantity) || 0;
                  const cost = Number(watchedItems[index]?.unitCost) || 0;
                  const lineTotal = qty * cost;

                  return (
                    <Card key={field.id} className="p-4">
                      <div className="grid gap-3 md:grid-cols-5 items-end">
                        <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Product</FormLabel>
                              <Select
                                onValueChange={f.onChange}
                                value={f.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem
                                      key={p.id}
                                      value={String(p.id)}
                                    >
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
                          name={`items.${index}.batchNo`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Batch No</FormLabel>
                              <FormControl>
                                <Input {...f} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Qty</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...f}
                                  onChange={(e) =>
                                    f.onChange(e.target.valueAsNumber || 0)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitCost`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Unit Cost</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...f}
                                  onChange={(e) =>
                                    f.onChange(e.target.valueAsNumber || 0)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">
                              Total
                            </p>
                            <p className="text-sm font-medium h-9 flex items-center">
                              ₹{lineTotal.toFixed(2)}
                            </p>
                          </div>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {/* Grand Total */}
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Grand Total</p>
                    <p className="text-lg font-bold">
                      ₹{grandTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : isEditMode
                    ? "Update"
                    : "Save Purchase"}
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
