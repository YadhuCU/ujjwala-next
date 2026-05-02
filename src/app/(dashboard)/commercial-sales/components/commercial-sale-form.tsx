"use client";

import { useEffect, useRef } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
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
} from "@/components/ui/form";
import { useStocks, useCustomers } from "@/hooks/use-api";
import { Plus, Trash2 } from "lucide-react";
import type { StockPayload, CustomerPayload } from "@/lib/api-client";
import { customerTxnOptions } from "@/lib/query-options";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ─── Schema ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  stockId: z.string().default(""),
  quantity: z.number().int().min(0),
  salePrice: z.number().min(0),
  netTotal: z.number().min(0).optional(),
  cylindersDispatched: z.number().int().min(0).default(0),
  cylindersReturned: z.number().int().min(0).default(0),
});

export const commercialSaleSchema = z.object({
  saleType: z.enum(["rent", "sale"]).default("rent"),   // ← header-level
  customerId: z.string().optional().nullable(),
  paymentType: z.enum(["cash", "cheque"]).default("cash"),
  discount: z.number().min(0).default(0),
  notes: z.string().optional().or(z.literal("")),
  paidAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0).optional(),
  items: z.array(itemSchema).default([]),
});

export type CommercialSaleFormValues = z.infer<typeof commercialSaleSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface CommercialSaleFormProps {
  defaultValues?: CommercialSaleFormValues;
  isEditMode?: boolean;
  onSubmit: (values: CommercialSaleFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CommercialSaleForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: CommercialSaleFormProps) {
  const { data: rawStocks = [] } = useStocks("Commercial");
  const stocks = rawStocks as StockPayload[];

  const { data: rawCustomers = [] } = useCustomers();
  const customers = rawCustomers as CustomerPayload[];

  const form = useForm<CommercialSaleFormValues>({
    resolver: zodResolver(commercialSaleSchema) as Resolver<CommercialSaleFormValues>,
    defaultValues: defaultValues ?? {
      saleType: "rent",
      customerId: null,
      paymentType: "cash",
      discount: 0,
      notes: "",
      paidAmount: 0,
      items: [{ stockId: "", quantity: 0, salePrice: 0, cylindersDispatched: 0, cylindersReturned: 0 }],
      totalAmount: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const watchedItems = form.watch("items");
  const watchedDiscount = form.watch("discount") || 0;
  const watchedSaleType = form.watch("saleType");
  const isRent = watchedSaleType === "rent";
  const selectedCustomerId = form.watch("customerId");

  const { data: txnInfo } = useQuery({
    ...customerTxnOptions(selectedCustomerId || ""),
    enabled: !!selectedCustomerId,
  });

  // NOTE: cylindersDispatched auto-fills from quantity on change but user can override it
  // (no useEffect — we don't want to reset it on every re-render)

  // Derive grand total
  const derivedTotal = watchedItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.salePrice) || 0);
  }, 0) - watchedDiscount;

  const prevDerived = useRef(derivedTotal);
  useEffect(() => {
    const current = form.getValues("totalAmount");
    if (current === undefined || current === prevDerived.current || current === 0) {
      form.setValue("totalAmount", Math.max(0, derivedTotal));
    }
    prevDerived.current = derivedTotal;
  }, [derivedTotal]); // eslint-disable-line

  const isCollectionOnly = watchedItems.length === 0;

  const handleSubmit = (values: CommercialSaleFormValues) => {
    const enrichedItems = values.items.map((item) => ({
      ...item,
      saleType: values.saleType,   // propagate header saleType to each item
      netTotal: (Number(item.quantity) || 0) * (Number(item.salePrice) || 0),
      cylindersDispatched: isRent ? (item.cylindersDispatched || 0) : 0,
      cylindersReturned: isRent ? (item.cylindersReturned || 0) : 0,
    }));
    const total = values.totalAmount !== undefined ? values.totalAmount : Math.max(0, derivedTotal);
    onSubmit({ ...values, items: enrichedItems, totalAmount: total });
  };

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>{isEditMode ? "Edit Commercial Sale" : "New Commercial Sale"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* Transaction info banner */}
            {txnInfo && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-sm space-y-2 border border-blue-200 dark:border-blue-800">
                <p><strong>Pending Amount:</strong> ₹{txnInfo.pending_amount.toFixed(2)}</p>
                {txnInfo.cylinder_breakdown && txnInfo.cylinder_breakdown.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <strong>Cylinders:</strong>
                    {txnInfo.cylinder_breakdown.map((b, i) => (
                      <Badge key={i} variant="secondary">{b.productName}: {b.quantity}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collection-only banner */}
            {isCollectionOnly && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 text-sm border border-amber-200 dark:border-amber-700">
                <p className="font-semibold text-amber-800 dark:text-amber-300">Collection-Only Invoice</p>
                <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                  No products — enter the collected amount in <strong>Paid Amount</strong> below.
                </p>
              </div>
            )}

            {/* ─── Sale Type — HEADER LEVEL ─── */}
            <FormField
              control={form.control}
              name="saleType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-semibold">Sale Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-6"
                      disabled={isEditMode}
                    >
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><RadioGroupItem value="rent" /></FormControl>
                        <FormLabel className="font-normal cursor-pointer text-base">
                          🔁 Rent (cylinder tracking)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><RadioGroupItem value="sale" /></FormControl>
                        <FormLabel className="font-normal cursor-pointer text-base">
                          🛒 Sale (outright)
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            {/* ─── Header Fields ─── */}
            <div className="grid gap-4 lg:grid-cols-3 items-start">
              <FormField control={form.control} name="customerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select Customer (Optional)" /></SelectTrigger>
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
              )} />

              <FormField control={form.control} name="paymentType" render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Payment Type</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><RadioGroupItem value="cash" /></FormControl>
                        <FormLabel className="font-normal cursor-pointer">Cash</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><RadioGroupItem value="cheque" /></FormControl>
                        <FormLabel className="font-normal cursor-pointer">Cheque</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="discount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="paidAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid Amount (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="lg:col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Cheque details, remarks..." />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            {/* ─── Items ─── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sale Items</h3>
                {!isEditMode && (
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => append({ stockId: "", quantity: 0, salePrice: 0, cylindersDispatched: 0, cylindersReturned: 0 })}>
                    <Plus className="w-4 h-4 mr-2" /> Add Item
                  </Button>
                )}
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No items yet. Add an item or use as collection-only invoice.</p>
              )}

              {fields.map((field, index) => {
                const currentStockId = watchedItems[index]?.stockId;
                const selectedStock = stocks.find((s) => s.id === Number(currentStockId));

                return (
                  <Card key={field.id} className="p-4 border-border">
                    <div className="flex flex-wrap gap-3 items-end">
                      {/* Stock */}
                      <FormField control={form.control} name={`items.${index}.stockId`}
                        render={({ field: ff }) => (
                          <FormItem className="flex-1 min-w-44">
                            <FormLabel>Stock / Batch</FormLabel>
                            <Select
                              onValueChange={(val) => {
                                ff.onChange(val);
                                const stock = stocks.find((s) => s.id === Number(val));
                                if (stock?.product?.salePrice) {
                                  form.setValue(`items.${index}.salePrice`, Number(stock.product.salePrice));
                                }
                              }}
                              value={ff.value}
                              disabled={isEditMode}
                            >
                              <FormControl><SelectTrigger><SelectValue placeholder="Select Stock" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {stocks.map((s) => (
                                  <SelectItem key={s.id} value={String(s.id)}>
                                    {s.product?.name} — {s.batchNo}
                                    {!isRent ? ` (Avail: ${s.quantity})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />

                      {/* Quantity */}
                      <FormField control={form.control} name={`items.${index}.quantity`}
                        render={({ field: ff }) => (
                          <FormItem className="w-28">
                            <FormLabel>Qty</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} disabled={isEditMode} {...ff}
                                onChange={(e) => {
                                  const qty = e.target.valueAsNumber || 0;
                                  ff.onChange(qty);
                                  // Auto-fill dispatched = qty on first entry — user can override
                                  if (isRent && form.getValues(`items.${index}.cylindersDispatched`) === 0) {
                                    form.setValue(`items.${index}.cylindersDispatched`, qty);
                                  }
                                }}
                              />
                            </FormControl>
                            {!isRent && selectedStock && (
                              <p className="text-xs text-muted-foreground">Max: {selectedStock.quantity}</p>
                            )}
                          </FormItem>
                        )} />

                      {/* Sale Price */}
                      <FormField control={form.control} name={`items.${index}.salePrice`}
                        render={({ field: ff }) => (
                          <FormItem className="w-36">
                            <FormLabel>Price (₹)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" disabled={isEditMode} {...ff}
                                onChange={(e) => ff.onChange(e.target.valueAsNumber || 0)} />
                            </FormControl>
                          </FormItem>
                        )} />

                      {/* Net Total (readonly) */}
                      <div className="w-28 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Net Total</p>
                        <div className="h-10 px-3 py-2 text-sm border rounded-md bg-muted/50 flex items-center">
                          ₹{((Number(watchedItems[index]?.quantity) || 0) * (Number(watchedItems[index]?.salePrice) || 0)).toFixed(2)}
                        </div>
                      </div>

                      {/* Cylinder fields — only when saleType = rent */}
                      {isRent && (
                        <>
                          <FormField control={form.control} name={`items.${index}.cylindersDispatched`}
                            render={({ field: ff }) => (
                              <FormItem className="w-36">
                                <FormLabel className="text-orange-700 dark:text-orange-400">Cylinders Out</FormLabel>
                                <FormControl>
                                  <Input type="number" min={0} disabled={isEditMode} {...ff}
                                    onChange={(e) => ff.onChange(e.target.valueAsNumber || 0)}
                                    className="border-orange-300 focus-visible:ring-orange-400" />
                                </FormControl>
                                {/* <p className="text-xs text-muted-foreground">Override if ≠ qty</p> */}
                              </FormItem>
                            )} />

                          <FormField control={form.control} name={`items.${index}.cylindersReturned`}
                            render={({ field: ff }) => (
                              <FormItem className="w-36">
                                <FormLabel className="text-green-700 dark:text-green-400">Cylinders Returned</FormLabel>
                                <FormControl>
                                  <Input type="number" min={0} disabled={isEditMode} {...ff}
                                    onChange={(e) => ff.onChange(e.target.valueAsNumber || 0)}
                                    className="border-green-300 focus-visible:ring-green-400" />
                                </FormControl>
                              </FormItem>
                            )} />
                        </>
                      )}

                      {!isEditMode && (
                        <Button type="button" variant="ghost" size="icon"
                          className="text-destructive self-end"
                          onClick={() => remove(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* ─── Grand Total ─── */}
            <div className="flex flex-col items-end space-y-2 pt-4 border-t">
              <div className="flex items-center gap-4">
                {!isCollectionOnly && (
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => form.setValue("totalAmount", Math.max(0, derivedTotal))}>
                    Recalculate
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">Grand Total: ₹</span>
                  <FormField control={form.control} name="totalAmount" render={({ field }) => (
                    <FormItem className="w-36">
                      <FormControl>
                        <Input type="number" step="0.01" className="text-xl font-bold text-right"
                          readOnly={!isCollectionOnly}
                          {...field} value={field.value ?? ""}
                          onChange={(e) => field.onChange(isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>
              {!isCollectionOnly && (
                <p className="text-xs text-muted-foreground">
                  Derived: ₹{derivedTotal.toFixed(2)} (items − discount)
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditMode ? "Update" : isCollectionOnly ? "Record Collection" : "Create Invoice"}
              </Button>
              <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
