"use client";

import { useArbSales } from "@/hooks/use-api";
import { PageWrapper } from "@/components/page-wrapper";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Trash2, Pencil } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import { useState } from "react";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { DeleteAlert } from "@/components/delete-alert";
import { ColumnDef } from "@tanstack/react-table";
import { ArbSale } from "@prisma/client";
import { ArbSalePayload } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";


export default function ArbSalesPage() {
  const { isAdmin } = usePermissions();

  const columns: ColumnDef<ArbSalePayload>[] = [
    {
      accessorKey: "trNo",
      header: "TR No",
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: (info) => new Date(info.getValue() as string).toLocaleDateString('en-IN'),
    },
    {
      accessorFn: (row) => row.customer?.name ?? "",
      id: "customer",
      header: "Customer",
    },
    {
      accessorKey: "paymentType",
      header: "Payment Type",
    },
    {
      accessorKey: "totalAmount",
      header: "Net Total",
      cell: (info) => (info.getValue() ? `₹${info.getValue()}` : ""),
    },
    {
      id: "actions",
      header: isAdmin ? "Actions" : undefined,
      cell: ({ row }) => {
        return isAdmin ? (
          <div className="flex items-center justify-end gap-2">
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/arb-sales/${row.original.id}/edit`}>
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
          </div>
        ) : null;
      },
    },
  ];

  const { data: arbSales = [], isLoading } = useArbSales();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = useApiMutation({
    url: deleteId ? `/api/arb-sales/${deleteId}` : "",
    method: "DELETE",
    invalidateKeys: [queryKeys.arbSales.all, queryKeys.stocks.all],
  });

  return (
    <PageWrapper
      title="ARB Sales"
      description="List of all multi-product ARB sales."
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/arb-sales/add">
            <Plus className="w-4 h-4 mr-2" /> Add ARB Sale
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>ARB Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={arbSales} />
        </CardContent>
      </Card>

      <DeleteAlert
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate({});
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />

    </PageWrapper>
  );
}
