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
import { DatePicker } from "@/components/ui/date-picker";
import { useStocks, useCustomers } from "@/hooks/use-api";
import { Plus, Trash2 } from "lucide-react";
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
  const availableStocks = stocks.filter((s) => s.quantity > 0);

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

  const watchedItems = form.watch("items");
  const selectedCustomerId = form.watch("customerId");

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
            onSubmit={form.handleSubmit(onSubmit)}
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
                    <div className="grid gap-3 md:grid-cols-5 items-start">
                      {/* Stock Selection */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.stockId`}
                        render={({ field: formField }) => {
                          const selectedStock = availableStocks.find(
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
                                      {selectedStock?.product?.name}
                                    </SelectValue>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availableStocks.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                      {s.product?.name} (Batch: {s.batchNo}) -
                                      Qty: {s.quantity}
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
