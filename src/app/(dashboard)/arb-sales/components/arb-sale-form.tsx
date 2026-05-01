"use client";

import { useEffect, useRef } from "react";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useStocks, useCustomers } from "@/hooks/use-api";
import { Plus, Trash2 } from "lucide-react";
import type { StockPayload, CustomerPayload } from "@/lib/api-client";
import { customerTxnOptions } from "@/lib/query-options";

// ─── Schema ──────────────────────────────────────────────────────────────────

const arbSaleItemSchema = z.object({
  stockId: z.string().optional().default(""),
  productId: z.number().optional(), // Inferred from stock
  quantity: z.number().int().min(0, "Qty must be ≥ 0"),
  salePrice: z.number().min(0, "Price must be ≥ 0"),
  netTotal: z.number().min(0).optional(),
});

export const arbSaleSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentType: z.enum(["cash", "cheque"]).optional(),
  discount: z.number().min(0).optional(),
  notes: z.string().optional().or(z.literal("")),
  paidAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  items: z.array(arbSaleItemSchema).default([]),
});

export type ArbSaleFormValues = z.infer<typeof arbSaleSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface ArbSaleFormProps {
  defaultValues?: ArbSaleFormValues;
  isEditMode?: boolean;
  onSubmit: (values: ArbSaleFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ArbSaleForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: ArbSaleFormProps) {
  // Only fetch stocks with available quantity for new sales
  const { data: rawStocks = [] } = useStocks("ARB");
  const stocks = rawStocks as StockPayload[];
  const availableStocks = stocks.filter(s => s.quantity > 0);

  const { data: rawCustomers = [] } = useCustomers();
  const customers = rawCustomers as CustomerPayload[];

  const form = useForm<ArbSaleFormValues>({
    resolver: zodResolver(arbSaleSchema),
    defaultValues: defaultValues ?? {
      customerId: null,
      paymentType: "cash",
      discount: 0,
      notes: "",
      paidAmount: 0,
      items: [{ stockId: "", quantity: 0, salePrice: 0 }],
      totalAmount: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");

  const watchedDiscount = form.watch("discount") || 0;
  const selectedCustomerId = form.watch("customerId");

  const { data: txnInfo } = useQuery({
    ...customerTxnOptions(selectedCustomerId || ""),
    enabled: !!selectedCustomerId
  });
  
  const calculateDerivedTotal = () => {
    return watchedItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.salePrice) || 0;
      return sum + qty * price;
    }, 0) - watchedDiscount;
  };

  const derivedTotal = calculateDerivedTotal();
  const previousDerivedTotal = useRef(derivedTotal);
  const isCollectionOnly = watchedItems.length === 0;

  useEffect(() => {
    const currentTotalAmount = form.getValues("totalAmount");
    if (
      currentTotalAmount === undefined ||
      currentTotalAmount === previousDerivedTotal.current ||
      currentTotalAmount === 0 
    ) {
      form.setValue("totalAmount", Math.max(0, derivedTotal));
    }
    previousDerivedTotal.current = derivedTotal;
  }, [derivedTotal, form]);

  const handleRecalculate = () => {
    form.setValue("totalAmount", Math.max(0, derivedTotal));
  };

  const handleSubmit = (values: ArbSaleFormValues) => {
    const enrichedItems = values.items.map((item) => ({
      ...item,
      netTotal: (Number(item.quantity) || 0) * (Number(item.salePrice) || 0),
    }));
    // If totalAmount wasn't explicitly set/overridden, fallback to calculation
    const currentTotal = values.totalAmount !== undefined ? values.totalAmount : derivedTotal;
    onSubmit({ ...values, items: enrichedItems, totalAmount: currentTotal });
  };

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>{isEditMode ? "Arb Sale Details" : "New Arb Sale"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Customer Transaction Info */}
            {txnInfo && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-sm space-y-1 border border-blue-200 dark:border-blue-800">
                <p>
                  <strong>Cylinders In Hand:</strong> {txnInfo.rent_qty}
                </p>
                <p>
                  <strong>Total Pending Amount:</strong> ₹{txnInfo.pending_amount}
                </p>
                {/*txnInfo.breakdown && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>Commercial: ₹{txnInfo.breakdown.commercial}</p>
                    <p>Domestic: ₹{txnInfo.breakdown.domestic}</p>
                    <p>ARB: ₹{txnInfo.breakdown.arb}</p>
                    <p>Initial: ₹{txnInfo.breakdown.initial}</p>
                  </div>
                )*/}
              </div>
            )}

            {/* Collection-Only Banner */}
            {isCollectionOnly && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 text-sm border border-amber-200 dark:border-amber-700 flex items-start gap-3">
                <span className="text-amber-600 dark:text-amber-400 text-lg leading-none">⚡</span>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Collection-Only Invoice</p>
                  <p className="text-amber-700 dark:text-amber-400 mt-0.5">No products will be dispatched. Enter the collected amount in the <strong>Paid Amount</strong> field below to record a lump-sum payment against this customer&apos;s pending balance.</p>
                </div>
              </div>
            )}

            {/* ─── Header Fields ──────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3 items-start">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Customer (Optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name} {c.phone ? `(${c.phone})` : ""}
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
                name="paymentType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Payment Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="cash" />
                          </FormControl>
                          <FormLabel className="font-normal">Cash</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="cheque" />
                          </FormControl>
                          <FormLabel className="font-normal">Cheque</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e.target.valueAsNumber || 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paidAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid Amount (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e.target.valueAsNumber || 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-1 lg:col-span-3">
                    <FormLabel>Notes (e.g. Cheque details)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Add any relevant notes here..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ─── Items Section ──────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sale Items</h3>
                {!isEditMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        stockId: "",
                        quantity: 0,
                        salePrice: 0,
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Item
                  </Button>
                )}
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No items added. Click &quot;Add Item&quot; to begin.
                </p>
              )}

              {fields.map((field, index) => {
                const currentStockId = watchedItems[index]?.stockId;
                const selectedStock = stocks.find(s => s.id === Number(currentStockId));

                return (
                  <Card key={field.id} className="p-4 border border-border">
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      {/* Stock Selection */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.stockId`}
                        render={({ field: formField }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Stock / Product</FormLabel>
                            <Select
                              onValueChange={(val) => {
                                formField.onChange(val);
                                // Auto-fill default sale price when stock is selected
                                const stock = stocks.find(s => s.id === Number(val));
                                if (stock && stock.product?.salePrice) {
                                  form.setValue(`items.${index}.salePrice`, Number(stock.product.salePrice));
                                }
                              }}
                              value={formField.value}
                              disabled={isEditMode}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Stock" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(isEditMode ? stocks : availableStocks).map((s) => (
                                  <SelectItem key={s.id} value={String(s.id)}>
                                    {s.product?.name} (Batch: {s.batchNo}) - Qty: {s.quantity}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Quantity */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field: formField }) => (
                          <FormItem className="w-full md:w-32">
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...formField}
                                onChange={(e) =>
                                  formField.onChange(
                                    e.target.valueAsNumber || 0
                                  )
                                }
                                disabled={isEditMode}
                              />
                            </FormControl>
                            {!isEditMode && selectedStock && (
                              <FormDescription>
                                Max: {selectedStock.quantity}
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Sale Price */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.salePrice`}
                        render={({ field: formField }) => (
                          <FormItem className="w-full md:w-40">
                            <FormLabel>Sale Price (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...formField}
                                onChange={(e) =>
                                  formField.onChange(
                                    e.target.valueAsNumber || 0
                                  )
                                }
                                disabled={isEditMode}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Net Total (Readonly calculation) */}
                      <div className="w-full md:w-32 space-y-2 mt-1 md:mt-0">
                        <FormLabel className="text-muted-foreground">
                          Net Total
                        </FormLabel>
                        <div className="h-10 px-3 py-2 text-sm border rounded-md bg-muted/50 flex items-center">
                          ₹
                          {(
                            (Number(watchedItems[index]?.quantity) || 0) *
                            (Number(watchedItems[index]?.salePrice) || 0)
                          ).toFixed(2)}
                        </div>
                      </div>

                      {/* Remove Button */}
                      {!isEditMode && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-8 text-destructive md:ml-2"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* ─── Grand Total ──────────────────── */}
            <div className="flex flex-col items-end pt-4 border-t space-y-2">
              <div className="flex items-center gap-4">
                {!isCollectionOnly && (
                  <Button type="button" variant="outline" size="sm" onClick={handleRecalculate}>
                    Recalculate Total
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">Grand Total: ₹</span>
                  <FormField
                    control={form.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem className="w-32">
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            readOnly={!isCollectionOnly}
                            className="text-xl font-bold text-right"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              {!isCollectionOnly && (
                <p className="text-xs text-muted-foreground mr-2">
                  Derived Total before edits: ₹{derivedTotal.toFixed(2)}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : isEditMode
                    ? "Update Notes"
                    : isCollectionOnly
                      ? "Record Collection"
                      : "Create Sale"}
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
