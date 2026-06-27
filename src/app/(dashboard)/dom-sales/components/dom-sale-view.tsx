"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePermission } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";
import { useDeleteMutation } from "@/hooks/use-api";
import { domSalesOptions } from "@/lib/query-options";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { DataTable } from "@/components/data-table";
import { PERMISSIONS } from "@/lib/permissions";
import { DomSaleResponse } from "@/module/dom-sale/dom-sale.serializer";
import { ColumnDef } from "@tanstack/react-table";

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
            {viewPurchasePermission && ""}
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
