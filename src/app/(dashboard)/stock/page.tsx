"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useStocks, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

interface Product {
  id: number;
  name: string | null;
}
interface Vendor {
  id: number;
  name: string;
}
interface Stock {
  id: number;
  batchNo: string | null;
  invoiceNo: string | null;
  quantity: number;
  productCost: number | null;
  product: Product | null;
  productId: number | null;
  vendor: Vendor | null;
  purchaseId: number | null;
}

export default function StockPage() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rawStocks = [] } = useStocks();
  const stocks = rawStocks as Stock[];

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.stocks.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<Stock>[] = [
    { accessorKey: "batchNo", header: "Batch No" },
    { accessorKey: "product.name", header: "Product" },
    {
      accessorKey: "vendor.name",
      header: "Vendor",
      cell: ({ row }) => {
        return row.original.vendor?.name || "—";
      },
    },
    { accessorKey: "invoiceNo", header: "Invoice No" },
    { accessorKey: "quantity", header: "Qty" },
    {
      accessorKey: "productCost",
      header: "Cost",
      cell: ({ row }) => {
        const cost = row.original.productCost;
        return cost ? `₹${cost}` : "";
      },
    },
  ];

  if (isAdmin) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="text-right space-x-2">
            {!s.purchaseId ? (
              <>
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/stock/${s.id}/edit`}>
                    <Pencil className="w-4 h-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(s.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground pr-2 italic">Linked to Purchase</span>
            )}
          </div>
        );
      },
    });
  }

  return (
    <PageWrapper
      title="Stock"
      addButton={
        isAdmin && (
          <Button asChild className="ml-auto">
            <Link href="/stock/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Stock
            </Link>
          </Button>
        )
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Stock List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={stocks} searchPlaceholder="Search stock..." />
        </CardContent>
      </Card>

      <DeleteAlert
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(`/api/stock/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </PageWrapper>
  );
}
