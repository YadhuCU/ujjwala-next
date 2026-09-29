"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePermission } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Pencil, Trash2 } from "lucide-react";
import { useDeleteMutation } from "@/hooks/use-api";
import { commercialSalesOptions } from "@/lib/query-options";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { DataTable } from "@/components/data-table";
import { PERMISSIONS } from "@/lib/permissions";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { CommercialSaleResponse } from "@/module/commercial-sale/commercial-sale.serializer";
import { CylinderReturnDialog } from "./commercial-sale-return-dialog";

export function CommercialSalesViewComponent() {
  const router = useRouter();

  const { hasPermission } = usePermission();
  const updatePermission = hasPermission(PERMISSIONS.COMMERCIAL_SALE_UPDATE);
  const deletePermission = hasPermission(PERMISSIONS.COMMERCIAL_SALE_DELETE);
  const viewPermission = hasPermission(PERMISSIONS.COMMERCIAL_SALE_READ);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data } = useSuspenseQuery(commercialSalesOptions);

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [
      queryKeys.commercialSales.all,
      queryKeys.stocks.all,
      queryKeys.customerTxn.all,
    ],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<CommercialSaleResponse>[] = [
    {
      accessorKey: "trNo",
      header: "Tr No",
    },
    {
      accessorKey: "customer.name",
      header: "Customer",
    },
    {
      accessorKey: "invoiceDate",
      header: "Invoice Date",
      cell: ({ row }) =>
        new Date(row.original.invoiceDate).toLocaleDateString("en-IN"),
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
                {item.product?.name} x {item.quantity}{" "}
                <Badge variant="outline">{item.saleType}</Badge>
              </div>
            ))}
          </div>
        ) : (
          "No items"
        );
      },
    },
    {
      id: "withCustomer",
      header: "Cylinders out",
      cell: ({ row }) => {
        const outstanding = row.original.items.reduce(
          (sum, item) => sum + item.cylindersOutstanding,
          0,
        );
        return outstanding > 0 ? (
          <span className="font-medium text-destructive">{outstanding}</span>
        ) : (
          "—"
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

  if (updatePermission || deletePermission || viewPermission) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const sale = row.original;
        return (
          <div className="text-right space-x-2">
            {viewPermission && <CommercialSaleDetailsDialog sale={sale} />}
            {updatePermission && <CylinderReturnDialog sale={sale} />}
            {updatePermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/commercial-sales/${sale.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {deletePermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(sale.id)}
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
          <CardTitle>Commercial Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data}
            searchPlaceholder="Search Commercial Sales..."
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
            deleteMutation.mutate(`/api/commercial-sales/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}

type CommercialSaleDetailsDialogProps = {
  sale: CommercialSaleResponse;
};

export function CommercialSaleDetailsDialog({
  sale,
}: CommercialSaleDetailsDialogProps) {
  const totalQty = sale.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Invoice #{sale.trNo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Invoice Information</h3>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <InfoField label="Customer" value={sale.customer?.name ?? "—"} />
              <InfoField
                label="Invoice Date"
                value={new Date(sale.invoiceDate).toLocaleDateString("en-IN")}
              />
              <InfoField label="Payment Type" value={sale.paymentType} />
              <InfoField label="Total Quantity" value={String(totalQty)} />
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
                value={`₹${Number(sale.discount ?? 0).toFixed(2)}`}
              />
              <InfoField
                label="Balance"
                value={`₹${(
                  Number(sale.totalAmount) - Number(sale.paidAmount)
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

          <div>
            <h3 className="mb-3 text-sm font-semibold">Invoice Items</h3>

            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-left">Batch No</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Dispatched</th>
                    <th className="p-3 text-right">Returned</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-right">Net Total</th>
                  </tr>
                </thead>

                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.product?.name}</td>
                      <td className="p-3">{item.stock?.batchNo}</td>
                      <td className="p-3">{item.saleType}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">
                        {item.cylindersDispatched}
                      </td>
                      <td className="p-3 text-right">
                        {item.cylindersReturned}
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
                    <td colSpan={3} className="p-3">
                      Total
                    </td>
                    <td className="p-3 text-right">{totalQty}</td>
                    <td colSpan={3} />
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
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
