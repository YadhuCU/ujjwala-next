"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Trash2, Pencil } from "lucide-react";
import { usePurchases, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PERMISSIONS } from "@/lib/permissions";
import { PurchaseResponse } from "@/module/purchase/purchase.serializer";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export default function PurchasesViewComponent() {
  const router = useRouter();

  const { hasPermission } = usePermission();
  const udpatePurchasePermission = hasPermission(PERMISSIONS.PURCHASE_UPDATE);
  const deletePurchasePermission = hasPermission(PERMISSIONS.PURCHASE_DELETE);
  const viewPurchasePermission = hasPermission(PERMISSIONS.PURCHASE_READ);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: purchases } = usePurchases();

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.purchases.all, queryKeys.stocks.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<PurchaseResponse>[] = [
    {
      accessorKey: "id",
      header: "Purchase #",
    },
    {
      accessorKey: "vendor.name",
      header: "Vendor",
    },
    {
      accessorKey: "purchaseDate",
      header: "Date",
      cell: ({ row }) =>
        new Date(row.original.purchaseDate).toLocaleDateString("en-IN"),
    },
    {
      id: "products",
      header: "Products",
      cell: ({ row }) => `${row.original.items.length} Product(s)`,
    },
    {
      id: "quantity",
      header: "Qty",
      cell: ({ row }) =>
        row.original.items.reduce((sum, item) => sum + item.quantity, 0),
    },
    {
      accessorKey: "totalCost",
      header: "Total Cost",
      cell: ({ row }) => `₹${Number(row.original.totalCost).toFixed(2)}`,
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
            {viewPurchasePermission && <PurchaseDetailsDialog purchase={p} />}
            {udpatePurchasePermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/purchases/${p.id}/edit`}>
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
          <CardTitle>Purchase List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={purchases}
            searchPlaceholder="Search purchases..."
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
            deleteMutation.mutate(`/api/purchases/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}

type PurchaseDetailsDialogProps = {
  purchase: PurchaseResponse;
};

export function PurchaseDetailsDialog({
  purchase,
}: PurchaseDetailsDialogProps) {
  const totalQty = purchase.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Purchase #{purchase.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Purchase Summary */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Purchase Information</h3>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <InfoField label="Vendor" value={purchase.vendor.name} />

              <InfoField
                label="Purchase Date"
                value={new Date(purchase.purchaseDate).toLocaleDateString(
                  "en-IN",
                )}
              />

              <InfoField label="Total Quantity" value={String(totalQty)} />

              <InfoField
                label="Total Cost"
                value={`₹${Number(purchase.totalCost).toFixed(2)}`}
              />
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Purchase Items</h3>

            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-left">Batch No</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {purchase.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.product.name}</td>

                      <td className="p-3">{item.batchNo}</td>

                      <td className="p-3">{item.purchaseType}</td>

                      <td className="p-3 text-right">{item.quantity}</td>

                      <td className="p-3 text-right">
                        ₹{Number(item.unitCost).toFixed(2)}
                      </td>

                      <td className="p-3 text-right font-medium">
                        ₹{Number(item.totalCost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
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
