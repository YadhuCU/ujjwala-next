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

interface PurchaseVendor {
  id: number;
  name: string;
}

interface Purchase {
  id: number;
  invoiceNo: string | null;
  vendorId: number;
  vendor: PurchaseVendor;
  totalAmount: string | number | null;
  purchaseDate: string | Date;
  notes: string | null;
}

export default function PurchasesViewComponent() {
  const router = useRouter();

  const { hasPermission } = usePermission();
  const udpatePurchasePermission = hasPermission(PERMISSIONS.PURCHASE_UPDATE);
  const deletePurchasePermission = hasPermission(PERMISSIONS.PURCHASE_DELETE);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rawPurchases = [] } = usePurchases();
  const purchases = rawPurchases as Purchase[];

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.purchases.all, queryKeys.stocks.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<Purchase>[] = [
    { accessorKey: "invoiceNo", header: "Invoice No" },
    { accessorKey: "vendor.name", header: "Vendor" },
    {
      accessorKey: "totalAmount",
      header: "Total Amount",
      cell: ({ row }) => {
        const amt = row.original.totalAmount;
        return amt ? `₹${Number(amt).toFixed(2)}` : "—";
      },
    },
    {
      accessorKey: "purchaseDate",
      header: "Date",
      cell: ({ row }) =>
        new Date(row.original.purchaseDate).toLocaleDateString("en-IN"),
    },
  ];

  if (udpatePurchasePermission || deletePurchasePermission) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="text-right space-x-2">
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
