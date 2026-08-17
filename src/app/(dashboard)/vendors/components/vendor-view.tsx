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
import { useVendors, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PERMISSIONS } from "@/lib/permissions";
import { VendorResponse } from "@/module/vendor/vendor.serializer";

export default function VendorsViewComponent() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const vendorUpdatePermission = hasPermission(PERMISSIONS.VENDOR_UPDATE);
  const vendorDeletePermission = hasPermission(PERMISSIONS.VENDOR_DELETE);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: vendors = [] } = useVendors();

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.vendors.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<VendorResponse>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "gstNumber", header: "GST Number" },
    { accessorKey: "address", header: "Address" },
  ];

  if (vendorUpdatePermission || vendorDeletePermission) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="text-right space-x-2">
            {vendorUpdatePermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/vendors/${v.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {vendorDeletePermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(v.id)}
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
          <CardTitle>Vendor List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={vendors}
            searchPlaceholder="Search vendors..."
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
            deleteMutation.mutate(`/api/vendors/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
