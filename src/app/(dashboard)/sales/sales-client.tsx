"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

interface Sale {
  id: number;
  trNo: string | null;
  quantity: string | null;
  salePrice: string | null;
  netTotal: string | null;
  createdAt: string;
  stock: { batchNo: string | null } | null;
  customer: { name: string | null } | null;
  product: { name: string | null } | null;
}

export function SalesClient({ sales }: { sales: Sale[] }) {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.sales.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<Sale, any>[] = [
    {
      accessorKey: 'trNo',
      header: 'TR No',
    },
    {
      accessorFn: (row) => row.customer?.name ?? '',
      id: 'customer',
      header: 'Customer',
    },
    {
      accessorFn: (row) => row.product?.name ?? '',
      id: 'product',
      header: 'Product',
    },
    {
      accessorFn: (row) => row.stock?.batchNo ?? '',
      id: 'batch',
      header: 'Batch',
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
    },
    {
      accessorKey: 'salePrice',
      header: 'Price',
      cell: (info) => (info.getValue() ? `₹${info.getValue()}` : ''),
    },
    {
      accessorKey: 'netTotal',
      header: 'Net Total',
      cell: (info) => (info.getValue() ? `₹${info.getValue()}` : ''),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: (info) => new Date(info.getValue() as string).toLocaleDateString('en-IN'),
    },
    {
      id: 'actions',
      header: isAdmin ? 'Actions' : undefined,
      cell: ({ row }) =>
        isAdmin ? (
          <div className="flex justify-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/sales/${row.original.id}/edit`}>
                <Pencil className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(row.original.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <PageWrapper
      title="Commercial Sales"
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/sales/add">
            <Plus className="w-4 h-4 mr-2" />
            New Sale
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={sales} />
        </CardContent>
      </Card>

      <DeleteAlert
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(`/api/sales/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </PageWrapper>
  );
}
