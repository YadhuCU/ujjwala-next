"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

interface Customer {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
  discount: string | null;
  location: { name: string | null } | null;
}

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.customers.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<Customer>[] = [
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

  if (isAdmin) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="text-right space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/customers/${c.id}/edit`}>
                <Pencil className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(c.id)}
              disabled={deleteMutation.isPending}
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
      title="Customers"
      showBackButton
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/customers/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={customers} searchPlaceholder="Search customers..." />
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
    </PageWrapper>
  );
}
