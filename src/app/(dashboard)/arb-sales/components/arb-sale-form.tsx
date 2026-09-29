"use client";

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
import {
  sortStockOldestFirst,
  stockOptionLabel,
} from "@/module/stock/stock.display";
import { useStocks, useCustomers } from "@/hooks/use-api";
import { Plus, Trash2 } from "lucide-react";
import { PaymentType, ProductType } from "@/generated/enums";
import { CustomerTxnInfo } from "../../_components/customer-txn-info";
import { ArbSaleFormSchema, ArbSaleFormValues } from "@/module/arb-sale/arb-sale.form.schema";

interface ARBSaleFormProps {
  defaultValues?: ArbSaleFormValues;
  isEditMode?: boolean;
  onSubmit: (values: ArbSaleFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ARBSaleForm({
  defaultValues,
  isEditMode = false,
  onSubmit,
  isPending,
}: ARBSaleFormProps) {
  const { data: stocks } = useStocks(ProductType.ARB);
  // Oldest batch first — the person taking the order should be offered
  // the stock that has been sitting longest.
  const availableStocks = sortStockOldestFirst(
    stocks.filter((s) => s.quantity > 0),
  );

  const { data: customers } = useCustomers();

  const form = useForm<ArbSaleFormValues>({
    resolver: zodResolver(ArbSaleFormSchema) as Resolver<ArbSaleFormValues>,
    defaultValues: defaultValues ?? {
      items: [
        {
          productId: "",
          quantity: "",
          salePrice: "",
          stockId: "",
        } as never,
      ],
      paidAmount: 0,
      paymentType: PaymentType.CASH,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() cannot be memoized; these values are display-only
  const watchedItems = form.watch("items");

  const selectedCustomerId = form.watch("customerId");

  /**
   * Computes grand total from all line items.
   */
  const grandTotal = watchedItems?.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.salePrice) || 0;
    return sum + qty * cost;
  }, 0);

  const handleSubmit = (values: ArbSaleFormValues) => {
    const enrichedItems = values.items.map((item) => ({
      ...item,
    }));
    onSubmit({ ...values, items: enrichedItems });
  };

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
          {isEditMode ? "ARB Sale Details" : "New ARB Sale"}
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

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 place-content-stretch">
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
                        onChange={(e) => {
                          field.onChange(e.target.valueAsNumber || 0);
                        }}
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
                const cost = Number(watchedItems[index]?.salePrice) || 0;

                const lineTotal = qty * cost;

                return (
                  <Card key={field.id} className="p-3 sm:p-4">
                    <div className="grid grid-cols-2 gap-3 [&>*:first-child]:col-span-2 [&>*:last-child]:col-span-2 md:[&>*:first-child]:col-span-1 md:[&>*:last-child]:col-span-1 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-start">
                      {/* Stock Selection */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.stockId`}
                        render={({ field: formField }) => {
                          // The live value from the form. `field` is the field-array entry, a
                          // snapshot from when the row was added — it does not change when a
                          // stock is picked, so looking it up there always found nothing.
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
                                  // Auto-fill default sale price when stock is selected
                                  const stock = stocks.find(
                                    (s) => s.id === Number(val),
                                  );
                                  if (stock && stock.product?.salePrice) {
                                    form.setValue(
                                      `items.${index}.salePrice`,
                                      Number(stock.product.salePrice),
                                    );
                                  }
                                }}
                                value={String(formField.value) || ""}
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
                            <FormLabel>Sale Price (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...formField}
                                onChange={(e) =>
                                  formField.onChange(
                                    e.target.valueAsNumber || 0,
                                  )
                                }
                                placeholder="Enter sale price"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Net Total (Readonly calculation) */}
                      <div className="flex items-end justify-between gap-2 border-t pt-2 md:justify-start md:border-0 md:pt-0">
                        <div className="md:mx-auto">
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

            {/* ─── Grand Total ──────────────────── */}
            <div className="flex flex-col items-end pt-4 border-t space-y-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold sm:text-xl">Grand Total: </span>
                  <p className="text-lg font-bold text-right tabular-nums sm:text-xl">
                    ₹{grandTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Button
                type="submit"
                disabled={!form.formState.isDirty}
                isLoading={isPending}
              >
                {isEditMode ? "Update Notes" : "Create Sale"}
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