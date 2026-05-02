"use client";

import { useState } from "react";
import { useCommercialSales } from "@/hooks/use-api";
import { useApiMutation } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { PageWrapper } from "@/components/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { DeleteAlert } from "@/components/delete-alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { ColumnDef } from "@tanstack/react-table";
import type { CommercialSalePayload } from "@/lib/api-client";

/**
 * Commercial Sales list page — mirrors the ARB Sales page structure.
 * Uses DataTable + DeleteAlert + permission-gated actions.
 */
export default function CommercialSalesPage() {
  const { isAdmin } = usePermissions();
  const { data: sales = [] } = useCommercialSales();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = useApiMutation({
    url: deleteId ? `/api/commercial-sales/${deleteId}` : "",
    method: "DELETE",
    // Invalidate both the list and customer transaction cache (cylinder ledger)
    invalidateKeys: [queryKeys.commercialSales.all, queryKeys.stocks.all],
  });

  const columns: ColumnDef<CommercialSalePayload>[] = [
    {
      accessorKey: "trNo",
      header: "TR No",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.trNo}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString("en-IN"),
    },
    {
      accessorFn: (row) => row.customer?.name ?? "—",
      id: "customer",
      header: "Customer",
    },
    {
      id: "saleType",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.items?.[0]?.saleType;
        return type ? (
          <Badge variant={type === "rent" ? "secondary" : "outline"} className="capitalize">
            {type}
          </Badge>
        ) : null;
      },
    },
    {
      accessorKey: "paymentType",
      header: "Payment",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.paymentType}
        </Badge>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => `₹${Number(row.original.totalAmount ?? 0).toLocaleString("en-IN")}`,
    },
    {
      accessorKey: "paidAmount",
      header: "Paid",
      cell: ({ row }) => `₹${Number(row.original.paidAmount ?? 0).toLocaleString("en-IN")}`,
    },
    // {
    //   id: "pending",
    //   header: "Pending",
    //   cell: ({ row }) => {
    //     const pending =
    //       Number(row.original.totalAmount ?? 0) - Number(row.original.paidAmount ?? 0);
    //     return (
    //       <span className={pending > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
    //         ₹{pending.toLocaleString("en-IN")}
    //       </span>
    //     );
    //   },
    // },
    {
      id: "actions",
      header: isAdmin ? "Actions" : undefined,
      cell: ({ row }) =>
        isAdmin ? (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/commercial-sales/${row.original.id}/edit`}>
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
      description="All commercial sale invoices with cylinder ledger tracking."
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/commercial-sales/add">
            <Plus className="w-4 h-4 mr-2" /> New Invoice
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Commercial Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={sales as CommercialSalePayload[]} />
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
