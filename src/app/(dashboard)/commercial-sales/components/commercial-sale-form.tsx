"use client";

import { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";
import {
  sortStockOldestFirst,
  stockOptionLabel,
} from "@/module/stock/stock.display";
import { useQuery } from "@tanstack/react-query";
import { customerTxnOptions } from "@/lib/query-options";
import { useStocks, useCustomers } from "@/hooks/use-api";
import { Cylinder, Plus, Trash2 } from "lucide-react";
import { CommercialSaleType, PaymentType, ProductType } from "@/generated/enums";
import { CustomerTxnInfo } from "../../_components/customer-txn-info";
import {
  CommercialSaleFormSchema,
  CommercialSaleFormValues,
} from "@/module/commercial-sale/commercial-sale.form.schema";

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
  const { data: stocks } = useStocks(ProductType.COMMERCIAL);
  // Oldest batch first — the person taking the order should be offered
  // the stock that has been sitting longest.
  const availableStocks = sortStockOldestFirst(
    stocks.filter((s) => s.quantity > 0),
  );

  const { data: customers } = useCustomers();

  const form = useForm<CommercialSaleFormValues>({
    resolver: zodResolver(
      CommercialSaleFormSchema,
    ) as Resolver<CommercialSaleFormValues>,
    defaultValues: defaultValues ?? {
      items: [
        {
          stockId: "",
          saleType: CommercialSaleType.RENT,
          quantity: "",
          salePrice: "",
        } as never,
      ],
      invoiceDate: new Date(),
      paidAmount: 0,
      paymentType: PaymentType.CASH,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Rows sit at 0 until something actually came back; only send the real ones.
  const handleSubmit = (values: CommercialSaleFormValues) =>
    onSubmit({
      ...values,
      returns: (values.returns ?? []).filter((row) => Number(row.quantity) > 0),
    });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() cannot be memoized; these values are display-only
  const watchedItems = form.watch("items");
  const selectedCustomerId = form.watch("customerId");

  /**
   * What the customer holds right now, so staff can record what came back on
   * this visit instead of hunting for the invoice it went out on.
   */
  const { data: customerSummary } = useQuery({
    ...customerTxnOptions(String(selectedCustomerId)),
    enabled: !!selectedCustomerId,
    select: (res) => res.data,
  });

  /**
   * One row per product the customer holds.
   *
   * On edit, a product this invoice already collected in full no longer shows
   * as held — it has to be merged back in, or the recorded quantity would
   * silently vanish from the form and be wiped on save.
   */
  const returnRows = useMemo(() => {
    const held = customerSummary?.pendingCylinders ?? [];

    const rows = held.map((row) => ({
      productId: row.productId,
      name: row.product?.name ?? `Product #${row.productId}`,
      held: row.pendingCylinder,
    }));

    const seen = new Set(rows.map((r) => r.productId));

    for (const recorded of defaultValues?.returns ?? []) {
      if (seen.has(recorded.productId)) continue;
      rows.push({
        productId: recorded.productId,
        name: `Product #${recorded.productId}`,
        held: 0,
      });
    }

    return rows;
  }, [customerSummary, defaultValues]);

  // Keep the form's `returns` array lined up with the rows on screen, without
  // discarding anything already typed.
  useEffect(() => {
    const current = form.getValues("returns") ?? [];
    const byProduct = new Map(current.map((r) => [r.productId, r.quantity]));

    form.setValue(
      "returns",
      returnRows.map((row) => ({
        productId: row.productId,
        quantity: byProduct.get(row.productId) ?? 0,
      })),
      { shouldDirty: false },
    );
  }, [returnRows, form]);

  /**
   * Computes grand total from all line items — display only.
   * The server recomputes the authoritative total.
   */
  const grandTotal = watchedItems?.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.salePrice) || 0;
    return sum + qty * price;
  }, 0);

  if (
    process.env.NODE_ENV !== "production" &&
    Object.keys(form.formState.errors).length > 0
  ) {
    console.warn("VALIDATION ERROR", form.formState.errors);
  }

  return (
    <Card className="mr-auto">
      <CardHeader>
        <CardTitle>
          {isEditMode ? "Commercial Sale Details" : "New Commercial Sale"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Customer Transaction Info */}
            {selectedCustomerId && (
              <CustomerTxnInfo customerId={selectedCustomerId} />
            )}

            <div className="grid gap-4 lg:grid-cols-2 place-content-stretch">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={field.value ? String(field.value) : ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
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
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Date</FormLabel>
                    <FormControl>
                      <DatePicker date={field.value} setDate={field.onChange} />
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
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 0)
                        }
                        placeholder="Enter Discount in amount"
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
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 0)
                        }
                        placeholder="Enter amount paid."
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
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any relevant notes here..."
                      />
                    </FormControl>
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
                        className="flex gap-4"
                      >
                        {Object.values(PaymentType).map((x) => (
                          <FormItem key={x} className="flex items-center">
                            <FormControl>
                              <RadioGroupItem value={x} />
                            </FormControl>
                            <FormLabel className="font-normal">{x}</FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ─── Items Section ──────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      stockId: "",
                      saleType: CommercialSaleType.RENT,
                      quantity: "",
                      salePrice: "",
                    } as never)
                  }
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No items added. Click &quot;Add Item&quot; to begin.
                </p>
              )}

              {fields.map((field, index) => {
                const qty = Number(watchedItems[index]?.quantity) || 0;
                const price = Number(watchedItems[index]?.salePrice) || 0;
                const lineTotal = qty * price;

                return (
                  <Card key={field.id} className="p-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-start">
                      {/* Stock Selection */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.stockId`}
                        render={({ field: formField }) => {
                          // Searched in the full list so a batch that is no longer on hand
                          // still labels itself.
                          const selectedStock = stocks.find(
                            (s) => s.id === Number(formField.value),
                          );
                          return (
                            <FormItem>
                              <FormLabel>Stock / Product</FormLabel>
                              <Select
                                onValueChange={(val) => {
                                  formField.onChange(Number(val));
                                  // Auto-fill default sale price for the batch
                                  const stock = stocks.find(
                                    (s) => s.id === Number(val),
                                  );
                                  if (stock?.product?.salePrice) {
                                    form.setValue(
                                      `items.${index}.salePrice`,
                                      Number(stock.product.salePrice),
                                    );
                                  }
                                }}
                                value={
                                  formField.value ? String(formField.value) : ""
                                }
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select Stock">
                                      {selectedStock ? stockOptionLabel(selectedStock) : undefined}
                                    </SelectValue>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availableStocks.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                      {stockOptionLabel(s)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      {/* Rent or outright sale — decided per line */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.saleType`}
                        render={({ field: formField }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select
                              onValueChange={formField.onChange}
                              value={formField.value}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Rent or Sale" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.values(CommercialSaleType).map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t}
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
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...f}
                                onChange={(e) =>
                                  f.onChange(e.target.valueAsNumber || 0)
                                }
                                placeholder="Enter quantity"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Sale Price */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.salePrice`}
                        render={({ field: formField }) => (
                          <FormItem>
                            <FormLabel>Rate (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...formField}
                                onChange={(e) =>
                                  formField.onChange(e.target.valueAsNumber || 0)
                                }
                                placeholder="Enter rate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Net Total (readonly calculation) */}
                      <div className="flex items-end gap-2">
                        <div className="mx-auto">
                          <p className="text-xs text-muted-foreground mb-1">
                            Total
                          </p>
                          <p className="text-sm font-medium h-9 flex items-center">
                            ₹{lineTotal.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* ─── Cylinders collected on this visit ──────────────── */}
            {selectedCustomerId ? (
              <div className="pt-2">
                <div className="mb-3 flex items-center gap-2">
                  <Cylinder className="text-muted-foreground h-4 w-4" />
                  <h3 className="font-semibold">Cylinders collected</h3>
                </div>

                {returnRows.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                    This customer is not holding any cylinders, so there is
                    nothing to collect.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs">
                      Enter what came back on this visit. Leave a row at 0 if
                      nothing was collected for that product.
                    </p>

                    {returnRows.map((row, index) => (
                      <FormField
                        key={row.productId}
                        control={form.control}
                        name={`returns.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem className="grid grid-cols-[minmax(0,1fr)_auto_7rem] items-center gap-3 space-y-0">
                            <FormLabel className="truncate font-normal">
                              {row.name}
                            </FormLabel>
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {row.held} held
                            </span>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                max={row.held}
                                inputMode="numeric"
                                {...field}
                                value={field.value ?? 0}
                              />
                            </FormControl>
                            <div className="col-span-3">
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* ─── Grand Total ──────────────────── */}
            <div className="flex flex-col items-end pt-4 border-t space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">Grand Total: </span>
                <p className="text-xl font-bold text-right">
                  ₹{grandTotal.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={!form.formState.isDirty}
                isLoading={isPending}
              >
                {isEditMode ? "Update Invoice" : "Create Invoice"}
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
