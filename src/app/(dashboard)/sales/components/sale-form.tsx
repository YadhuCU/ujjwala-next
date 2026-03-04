"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
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
import { useCustomers } from "@/hooks/use-api";
import { customerTxnOptions, stocksOptions } from "@/lib/query-options";
import { StockPayload, CustomerPayload } from "@/lib/api-client";
import { useEffect } from "react";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const saleSchema = z.object({
  stockId: z.string().min(1, "Stock is required"),
  customerId: z.string().min(1, "Customer is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  discount: z.number().min(0),
  saleType: z.enum(["sale", "rent"], { message: "Select sale type" }),
  paymentType: z.enum(["cash", "cheque"], { message: "Select payment type" }),
  collection: z.number().min(0),
  emptyReturn: z.number().min(0),
});

export type SaleFormValues = z.infer<typeof saleSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

export type Stock = StockPayload;

export type Customer = CustomerPayload;

// ─── Props ───────────────────────────────────────────────────────────────────

interface SaleFormProps {
  /** When provided, form is in edit mode */
  defaultValues?: SaleFormValues;
  /** Whether sale type radio should be disabled (edit mode) */
  isEditMode?: boolean;
  /** Original sale's stock allocation (used to show correct available qty) */
  originalStockAllocation?: { stockId: number; quantity: number } | null;
  /** Submit handler — called with form values + selected stock's prices */
  onSubmit: (values: SaleFormValues, selectedStock: Stock | undefined) => void;
  /** Whether the mutation is in progress */
  isPending: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SaleForm({
  defaultValues,
  isEditMode = false,
  originalStockAllocation,
  onSubmit,
  isPending,
}: SaleFormProps) {
  const { data: stocks = [] } = useQuery({
    ...stocksOptions("Commercial"), 
    select: res => res.filter(x => x.quantity !== 0)
  });
  const { data: customers = [] } = useCustomers() as { data: Customer[] };

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: defaultValues ?? {
      stockId: "",
      customerId: "",
      quantity: 0,
      discount: 0,
      saleType: "rent",
      paymentType: "cash",
      collection: 0,
      emptyReturn: 0,
    },
  });

  const selectedStockId = form.watch("stockId");
  const selectedCustomerId = form.watch("customerId");
  const saleType = form.watch("saleType");
  const selectedStock = stocks.find((s) => s.id === parseInt(selectedStockId));

  useEffect(() => {
  if(selectedCustomerId && !defaultValues) {
    const customer = customers.find((c) => c.id === parseInt(selectedCustomerId));
    if(customer && customer.discount) {
      form.setValue("discount", Number(customer.discount));
    }
  }
  },[selectedCustomerId, customers, form, defaultValues])

  // Show correct available quantity:
  // In edit mode, add back the original allocation if it's the same stock
  const availableQty = selectedStock
    ? selectedStock.quantity +
      (originalStockAllocation &&
      originalStockAllocation.stockId === parseInt(selectedStockId)
        ? originalStockAllocation.quantity
        : 0)
    : null;

  const { data: txnInfo } = useQuery(customerTxnOptions(selectedCustomerId));

  const showEmptyReturn = isEditMode ? saleType === "rent" : true;

  return (
    <Card className="container mr-auto">
      <CardHeader>
        <CardTitle>Sale Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => onSubmit(v, selectedStock))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Stock */}
              <FormField
                control={form.control}
                name="stockId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock (Batch)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Stock" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stocks.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.batchNo} - {s.product?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer */}
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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

              {/* Quantity + Available */}
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
                    {availableQty !== null && (
                      <FormDescription>
                        Available: <strong>{availableQty}</strong>
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Discount */}
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount (%)</FormLabel>
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

              {/* Sale Type */}
              <FormField
                control={form.control}
                name="saleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                        disabled={isEditMode}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="rent" id="sale-type-rent" />
                          <label
                            htmlFor="sale-type-rent"
                            className={`text-sm font-medium ${isEditMode ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            Rent
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sale" id="sale-type-sale" />
                          <label
                            htmlFor="sale-type-sale"
                            className={`text-sm font-medium ${isEditMode ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            Sale
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    {isEditMode && (
                      <FormDescription className="text-xs">
                        Sale type cannot be changed after creation.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Type */}
              <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cash" id="payment-type-cash" />
                          <label htmlFor="payment-type-cash" className="text-sm font-medium cursor-pointer">
                            Cash
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cheque" id="payment-type-cheque" />
                          <label htmlFor="payment-type-cheque" className="text-sm font-medium cursor-pointer">
                            Cheque
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Collection Amount */}
              <FormField
                control={form.control}
                name="collection"
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

              {/* Empty Returned */}
              {showEmptyReturn && (
                <FormField
                  control={form.control}
                  name="emptyReturn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empty Returned</FormLabel>
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
              )}
            </div>

            {/* Stock Info */}
            {selectedStock && (
              <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
                <p>
                  <strong>Sale Price:</strong> ₹{String(selectedStock.product?.salePrice)}
                </p>
                <p>
                  <strong>Product Cost:</strong> ₹{String(selectedStock.productCost)}
                </p>
              </div>
            )}

            {/* Customer Transaction Info */}
            {txnInfo && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-sm space-y-1 border border-blue-200 dark:border-blue-800">
                <p>
                  <strong>Cylinders In Hand:</strong> {txnInfo.rent_qty}
                </p>
                <p>
                  <strong>Pending Amount:</strong> ₹{txnInfo.pending_amount}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : isEditMode
                    ? "Update Sale"
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
