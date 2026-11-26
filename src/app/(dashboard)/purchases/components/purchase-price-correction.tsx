"use client";

import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSummary } from "@/components/form-summary";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import {
  PurchasePriceCorrectionFormSchema,
  type PurchasePriceCorrectionFormValues,
} from "@/module/purchase/purchase.form.schema";
import type { PurchaseDetailResponse } from "@/module/purchase/purchase.serializer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Product · type · qty · was · unit cost · line total (from md up)
const LINE_GRID =
  "grid md:grid-cols-[minmax(0,2.4fr)_0.7fr_0.5fr_0.9fr_1.2fr_1fr]";

const rupees = (value: number | undefined) =>
  value === undefined ? "—" : `₹${value.toFixed(2)}`;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * The edit page for a purchase whose stock has already been sold from. A full
 * edit would replace its batches under those sales, so only what moves no
 * cylinders can change here: unit costs, the invoice number and notes.
 */
export function PurchasePriceCorrection({
  purchase,
}: {
  purchase: PurchaseDetailResponse;
}) {
  const router = useRouter();

  const form = useForm<PurchasePriceCorrectionFormValues>({
    resolver: zodResolver(
      PurchasePriceCorrectionFormSchema,
    ) as Resolver<PurchasePriceCorrectionFormValues>,
    defaultValues: {
      invoiceNo: purchase.invoiceNo ?? "",
      notes: purchase.notes ?? "",
      reason: "",
      items: purchase.items.map((item) => ({
        id: item.id,
        unitCost: item.unitCost ?? 0,
      })),
    },
  });

  const mutation = useApiMutation({
    url: `/api/purchases/${purchase.id}/prices`,
    method: "PATCH",
    // Past profit follows the batch cost, so the profit report moves too
    invalidateKeys: [
      queryKeys.purchases.all,
      queryKeys.stocks.all,
      queryKeys.purchaseReport.all,
      queryKeys.profitReport.all,
    ],
    onSuccess: () => {
      toast.success("Purchase prices corrected");
      router.push("/purchases");
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() cannot be memoized; these values are display-only
  const watched = form.watch("items") ?? [];
  const costOf = (index: number) => Number(watched[index]?.unitCost) || 0;
  const total = purchase.items.reduce(
    (sum, item, index) => sum + costOf(index) * item.quantity,
    0,
  );

  return (
    <div className="mr-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Correct purchase prices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info />
            <AlertTitle>Stock from this purchase has already been sold</AlertTitle>
            <AlertDescription>
              Only the unit costs, invoice number and notes can be corrected. The
              cylinder counts stay as they are, and profit on what has already
              been sold is recalculated at the corrected cost. To change a
              quantity, product, type, vendor or date, use a stock adjustment, or
              delete the sales that used this stock first.
            </AlertDescription>
          </Alert>

          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Vendor</dt>
              <dd className="font-medium">{purchase.vendor?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Purchase date</dt>
              <dd className="font-medium">
                {new Date(purchase.purchaseDate).toLocaleDateString("en-IN")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current total</dt>
              <dd className="font-medium tabular-nums">
                {rupees(purchase.totalCost)}
              </dd>
            </div>
          </dl>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

              {/* One row per line: a table on wide screens, stacked on a phone
                  so the unit cost — the one thing to edit — stays in view */}
              <div className="divide-y rounded-md border">
                <div className={`${LINE_GRID} text-muted-foreground hidden gap-3 bg-muted/50 px-3 py-2 text-xs font-medium md:grid`}>
                  <span>Product</span>
                  <span>Type</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Was</span>
                  <span>Unit cost</span>
                  <span className="text-right">Line total</span>
                </div>
                {purchase.items.map((item, index) => {
                  const changed = costOf(index) !== (item.unitCost ?? 0);
                  return (
                    <div
                      key={item.id}
                      className={`${LINE_GRID} grid-cols-2 items-center gap-3 px-3 py-3`}
                    >
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <p className="font-medium">{item.product?.name}</p>
                        <p className="text-muted-foreground text-xs break-all">
                          {item.batchNo}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs md:hidden">
                          {item.purchaseType} · {item.quantity} × was{" "}
                          {rupees(item.unitCost)}
                        </p>
                      </div>
                      <span className="hidden text-sm md:block">
                        {item.purchaseType}
                      </span>
                      <span className="hidden text-right text-sm tabular-nums md:block">
                        {item.quantity}
                      </span>
                      <span className="text-muted-foreground hidden text-right text-sm tabular-nums md:block">
                        {rupees(item.unitCost)}
                      </span>
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitCost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="md:sr-only">Unit cost</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                aria-label={`Unit cost for ${item.product?.name}`}
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
                      <div className="text-right">
                        <p className="text-muted-foreground mb-1 text-xs md:hidden">
                          Line total
                        </p>
                        <p className="text-sm tabular-nums">
                          {rupees(costOf(index) * item.quantity)}
                        </p>
                        {changed && (
                          <Badge variant="outline" className="mt-1">
                            changed
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for the correction</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="e.g. Unit cost entered as 800, vendor bill says 850"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormSummary label="Corrected total" amount={total}>
                <Button
                  type="submit"
                  isLoading={mutation.isPending}
                  disabled={!form.formState.isDirty}
                >
                  Save correction
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.history.back()}
                >
                  Cancel
                </Button>
              </FormSummary>
            </form>
          </Form>
        </CardContent>
      </Card>

      {purchase.priceCorrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Price corrections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">From</TableHead>
                    <TableHead className="text-right">To</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.priceCorrections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell>{c.productName}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {c.batchNo}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rupees(c.oldUnitCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rupees(c.newUnitCost)}
                      </TableCell>
                      <TableCell className="max-w-[280px] text-xs">
                        {c.reason}
                      </TableCell>
                      <TableCell>{c.createdBy ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
