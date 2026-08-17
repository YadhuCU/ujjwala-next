"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PERMISSIONS } from "@/lib/permissions";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsOptions } from "@/lib/query-options";
import { ProductResponse } from "@/module/product/product.serializer";

export function ProductsViewComponent() {
  const router = useRouter();

  const { hasPermission } = usePermission();

  const updatePermisson = hasPermission(PERMISSIONS.PRODUCT_UPDATE);
  const deletePermisson = hasPermission(PERMISSIONS.PRODUCT_DELETE);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: products = [] } = useSuspenseQuery({ ...productsOptions() });

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.products.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<ProductResponse>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "type", header: "Type" },
    { accessorKey: "weight", header: "Weight" },
    {
      accessorKey: "salePrice",
      header: "Sale Price",
      cell: ({ row }) => {
        const price = row.original.salePrice;
        return price ? `₹${price}` : "";
      },
    },
  ];

  if (updatePermisson || deletePermisson) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="text-right space-x-2">
            {updatePermisson && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/products/${p.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {deletePermisson && (
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
          <CardTitle>Product List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={products}
            searchPlaceholder="Search products..."
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
            deleteMutation.mutate(`/api/products/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
