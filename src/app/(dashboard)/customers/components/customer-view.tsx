"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { useCustomers, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { CustomerResponse } from "@/module/customer/customer.serializer";
import { PERMISSIONS } from "@/lib/permissions";

export function CustomerViewComponent() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const customerDeletePermission = hasPermission(PERMISSIONS.CUSTOMER_DELETE);
  const customerUpdatePermission = hasPermission(PERMISSIONS.CUSTOMER_UPDATE);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.customers.all],
    onSuccess: () => router.refresh(),
  });

  const { data: customers } = useCustomers();

  const columns: ColumnDef<CustomerResponse>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "address", header: "Address" },
    { accessorKey: "location.name", header: "Location" },
    {
      accessorKey: "discount",
      header: "Discount",
      cell: ({ row }) => {
        const d = row.original.discount;
        return d ? `${d}%` : "";
      },
    },
    { accessorKey: "phone", header: "Phone" },
  ];

  if (customerDeletePermission || customerUpdatePermission) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="text-right space-x-2">
            {customerUpdatePermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/customers/${c.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {customerDeletePermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(c.id)}
                disabled={deleteMutation.isPending}
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
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={customers}
            searchPlaceholder="Search customers..."
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
            deleteMutation.mutate(`/api/customers/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
