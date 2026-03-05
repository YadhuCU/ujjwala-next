"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { usePurchases, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

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

export default function PurchasesPage() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
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
      cell: ({ row }) => new Date(row.original.purchaseDate).toLocaleDateString("en-IN"),
    },
  ];

  if (isAdmin) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="text-right space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/purchases/${p.id}/edit`}>
                <Eye className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(p.id)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        );
      },
    });
  }

  return (
    <PageWrapper
      title="Purchases"
      addButton={
        isAdmin && (
          <Button asChild className="ml-auto">
            <Link href="/purchases/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Purchase
            </Link>
          </Button>
        )
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Purchase List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={purchases} searchPlaceholder="Search purchases..." />
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
    </PageWrapper>
  );
}
