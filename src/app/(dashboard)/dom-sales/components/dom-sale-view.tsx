"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePermission } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Pencil, Trash2 } from "lucide-react";
import { useDeleteMutation } from "@/hooks/use-api";
import { domSalesOptions } from "@/lib/query-options";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { DataTable } from "@/components/data-table";
import { PERMISSIONS } from "@/lib/permissions";
import { DomSaleResponse } from "@/module/dom-sale/dom-sale.serializer";
import { ColumnDef } from "@tanstack/react-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export function DomSalesViewComponent() {
  const router = useRouter();

  const { hasPermission } = usePermission();
  const udpatePurchasePermission = hasPermission(
    PERMISSIONS.DOMESTIC_SALE_UPDATE,
  );
  const deletePurchasePermission = hasPermission(
    PERMISSIONS.DOMESTIC_SALE_DELETE,
  );
  const viewPurchasePermission = hasPermission(PERMISSIONS.DOMESTIC_SALE_READ);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: domSales } = useSuspenseQuery({
    ...domSalesOptions,
    select: (res) => res.data,
  });

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.purchases.all, queryKeys.stocks.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<DomSaleResponse>[] = [
    {
      accessorKey: "trNo",
      header: "Tr No",
    },
    {
      accessorKey: "customer.name",
      header: "Customer",
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }) => {
        const items = row.original.items;
        return items?.length > 0 ? (
          <div className="text-sm">
            {items.map((item, idx) => (
              <div key={idx}>
                {item.product?.name} x {item.quantity}
              </div>
            ))}
          </div>
        ) : (
          "No items"
        );
      },
    },
    {
      accessorKey: "paidAmount",
      header: "Paid amount",
      cell: ({ row }) => `₹${Number(row.original.paidAmount).toFixed(2)}`,
    },
    {
      accessorKey: "totalAmount",
      header: "Total amount",
      cell: ({ row }) => `₹${Number(row.original.totalAmount).toFixed(2)}`,
    },
  ];

  if (
    udpatePurchasePermission ||
    deletePurchasePermission ||
    viewPurchasePermission
  ) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="text-right space-x-2">
            {viewPurchasePermission && <DomesticSaleDetailsDialog sale={p} />}
            {udpatePurchasePermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/dom-sales/${p.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {deletePurchasePermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(p.id)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Domestic Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={domSales}
            searchPlaceholder="Search Domestic Sales..."
          />
        </CardContent>
      </Card>

      <DeleteAlert
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(`/api/dom-sales/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}

type DomesticSaleDetailsDialogProps = {
  sale: DomSaleResponse;
};

export function DomesticSaleDetailsDialog({
  sale,
}: DomesticSaleDetailsDialogProps) {
  const totalQty = sale.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Sale #{sale.trNo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sale Summary */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Sale Information
            </h3>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <InfoField
                label="Customer"
                value={sale.customer.name}
              />

              <InfoField
                label="Sale Date"
                value={new Date(sale.createdAt).toLocaleDateString(
                  "en-IN",
                )}
              />

              <InfoField
                label="Payment Type"
                value={sale.paymentType}
              />

              <InfoField
                label="Total Quantity"
                value={String(totalQty)}
              />

              <InfoField
                label="Total Amount"
                value={`₹${Number(sale.totalAmount).toFixed(2)}`}
              />

              <InfoField
                label="Paid Amount"
                value={`₹${Number(sale.paidAmount).toFixed(2)}`}
              />

              <InfoField
                label="Discount"
                value={`₹${Number(sale.discount).toFixed(2)}`}
              />

              <InfoField
                label="Balance"
                value={`₹${(
                  Number(sale.totalAmount) -
                  Number(sale.paidAmount) -
                  Number(sale.discount)
                ).toFixed(2)}`}
              />
            </div>

            {sale.notes && (
              <div className="mt-4">
                <InfoField label="Notes" value={sale.notes} />
              </div>
            )}
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Sale Items
            </h3>

            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-left">Batch No</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Sale Price</th>
                    <th className="p-3 text-right">Net Total</th>
                  </tr>
                </thead>

                <tbody>
                  {sale.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t"
                    >
                      <td className="p-3">
                        {item.product.name}
                      </td>

                      <td className="p-3">
                        {item.stock.batchNo}
                      </td>

                      <td className="p-3 text-right">
                        {item.quantity}
                      </td>

                      <td className="p-3 text-right">
                        ₹{Number(item.salePrice).toFixed(2)}
                      </td>

                      <td className="p-3 text-right font-medium">
                        ₹{Number(item.netTotal).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="border-t bg-muted/40 font-medium">
                  <tr>
                    <td colSpan={2} className="p-3">
                      Total
                    </td>

                    <td className="p-3 text-right">
                      {totalQty}
                    </td>

                    <td />

                    <td className="p-3 text-right">
                      ₹{Number(sale.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type InfoFieldProps = {
  label: string;
  value: string;
};

function InfoField({ label, value }: InfoFieldProps) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">
        {label}
      </p>
      <p className="font-medium">{value}</p>
    </div>
  );
}