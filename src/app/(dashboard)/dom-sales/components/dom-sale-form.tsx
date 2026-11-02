"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { domSaleFieldStaffOptions } from "@/lib/query-options";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
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
import { useStocks } from "@/hooks/use-api";
import { Info, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DomSaleFormSchema,
  DomSaleFormValues,
} from "@/module/dom-sale/dom-sale.form.schema";
import { CommercialSaleType, PaymentType, ProductType } from "@/generated/enums";

interface DomSaleFormProps {
  defaultValues?: DomSaleFormValues;
  isEditMode?: boolean;
  /**
   * Set when editing a sale entered against a customer, before domestic sales
   * moved to field staff. The server refuses to edit those, so the form says
   * so up front instead of letting someone fill it in for nothing.
   */
  legacyCustomerName?: string;
  onSubmit: (values: DomSaleFormValues) => void;
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DomSaleForm({
  defaultValues,
  isEditMode = false,
  legacyCustomerName,
  onSubmit,
  isPending,
}: DomSaleFormProps) {
  // Only fetch stocks with available quantity for new sales `/api/stocks`
  const { data: stocks } = useStocks(ProductType.DOMESTIC);
  // Oldest batch first — the person taking the order should be offered
  // the stock that has been sitting longest.
  const availableStocks = sortStockOldestFirst(
    stocks.filter((s) => s.quantity > 0),
  );

  // The office picks whose round this is; a field staff member's sale is
  // simply theirs, so they get no dropdown. The server enforces the same rule.
  const { hasPermission } = usePermission();
  const canPickStaff = hasPermission(PERMISSIONS.DOMESTIC_SALE_READ_ALL);
  const { data: session } = useSession();
  const { data: fieldStaff = [] } = useQuery({
    ...domSaleFieldStaffOptions,
    enabled: canPickStaff,
  });

  const form = useForm<DomSaleFormValues>({
    resolver: zodResolver(DomSaleFormSchema) as Resolver<DomSaleFormValues>,
    defaultValues: defaultValues ?? {
      items: [
        {
          productId: "",
          quantity: "",
          salePrice: "",
          stockId: "",
          saleType: CommercialSaleType.SALE,
          emptiesCollected: 0,
        } as never,
      ],
      paymentType: PaymentType.CASH,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() cannot be memoized; these values are display-only
  const watchedItems = form.watch("items");

  const watchedDiscount = Number(form.watch("discount")) || 0;

  /** On a refill the empties follow the quantity until someone changes them. */
  const syncEmpties = (index: number, quantity: number) => {
    if (form.getValues(`items.${index}.saleType`) === CommercialSaleType.RENT)
      form.setValue(`items.${index}.emptiesCollected`, quantity, {
        shouldValidate: true,
      });
  };

  const subtotal = watchedItems?.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.salePrice) || 0;
    return sum + qty * cost;
  }, 0);
  // What the field staff collects — the whole amount, less any discount. The
  // server recomputes it; this is for display.
  const grandTotal = Math.max(subtotal - watchedDiscount, 0);

  const handleSubmit = (values: DomSaleFormValues) => {
    if (canPickStaff && !values.fieldStaffId) {
      form.setError("fieldStaffId", {
        message: "Select the field staff who made this sale",
      });
      return;
    }
    // Someone recording their own round never names a field staff
    onSubmit({
      ...values,
      fieldStaffId: canPickStaff ? values.fieldStaffId : undefined,
    });
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
          {isEditMode ? "Domestic Sale Details" : "New Domestic Sale"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {legacyCustomerName && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This sale was recorded against {legacyCustomerName}, before
                  domestic sales moved to field staff, so it cannot be edited.
                  Delete it from the list and enter it again instead.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 place-content-stretch">
              {canPickStaff ? (
                <FormField
                  control={form.control}
                  name="fieldStaffId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field staff</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={field.value ? String(field.value) : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Who made this round?" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fieldStaff.map((staff) => (
                            <SelectItem key={staff.id} value={String(staff.id)}>
                              {staff.name || staff.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Field staff</p>
                  <p className="bg-muted/50 flex h-10 items-center rounded-md border px-3 text-sm md:h-9">
                    {session?.user?.name ?? "You"}
                  </p>
                </div>
              )}

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
                      saleType: CommercialSaleType.SALE,
                      emptiesCollected: 0,
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

                const isRefill =
                  watchedItems[index]?.saleType === CommercialSaleType.RENT;

                return (
                  <Card key={field.id} className="p-3 sm:p-4">
                    <div className="grid grid-cols-2 gap-3 [&>*:first-child]:col-span-2 [&>*:last-child]:col-span-2 md:[&>*:first-child]:col-span-1 md:[&>*:last-child]:col-span-1 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-start">
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

                      {/* Rent (refill) or Sale */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.saleType`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select
                              value={f.value}
                              onValueChange={(value) => {
                                f.onChange(value);
                                // A refill brings the empty back; an outright sale does not
                                form.setValue(
                                  `items.${index}.emptiesCollected`,
                                  value === CommercialSaleType.RENT
                                    ? Number(form.getValues(`items.${index}.quantity`)) || 0
                                    : 0,
                                  { shouldValidate: true },
                                );
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Rent or Sale" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={CommercialSaleType.SALE}>SALE</SelectItem>
                                <SelectItem value={CommercialSaleType.RENT}>RENT</SelectItem>
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
                                onChange={(e) => {
                                  const quantity = e.target.valueAsNumber || 0;
                                  f.onChange(quantity);
                                  syncEmpties(index, quantity);
                                }}
                                placeholder="Enter quantity"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Empties collected — refills only */}
                      {isRefill ? (
                        <FormField
                          control={form.control}
                          name={`items.${index}.emptiesCollected`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="whitespace-nowrap">
                                Empties back
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={qty || undefined}
                                  inputMode="numeric"
                                  {...f}
                                  value={f.value ?? 0}
                                  onChange={(e) =>
                                    f.onChange(e.target.valueAsNumber || 0)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        // Keeps the columns aligned with refill lines
                        <div aria-hidden className="hidden md:block" />
                      )}

                      {/* Sale Price */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.salePrice`}
                        render={({ field: formField }) => (
                          // Alone on its row on a phone unless empties sit beside it
                          <FormItem className={isRefill ? undefined : "max-md:col-span-2"}>
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
            <div className="flex flex-col items-end gap-1 border-t pt-4">
              {watchedDiscount > 0 && (
                <p className="text-muted-foreground text-sm tabular-nums">
                  Subtotal ₹{subtotal.toFixed(2)} · Discount ₹
                  {watchedDiscount.toFixed(2)}
                </p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold sm:text-xl">Grand Total: </span>
                <p className="text-lg font-bold text-right tabular-nums sm:text-xl">
                  ₹{grandTotal.toFixed(2)}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                Collected in full by the field staff
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Button
                type="submit"
                disabled={!form.formState.isDirty || !!legacyCustomerName}
                isLoading={isPending}
              >
                {isEditMode ? "Update Sale" : "Create Sale"}
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
