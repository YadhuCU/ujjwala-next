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
import { useLocations, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { LocationResponse } from "@/module/location/location.serializer";
import { PERMISSIONS } from "@/lib/permissions";

export function LocationViewComponent() {
  const router = useRouter();

  const { hasPermission } = usePermission();
  const deleteLocationPermission = hasPermission(PERMISSIONS.LOCATION_DELETE);
  const udpateLocationPermission = hasPermission(PERMISSIONS.LOCATION_UPDATE);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: locations = [] } = useLocations();

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.locations.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<LocationResponse>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "district", header: "District" },
    { accessorKey: "pincode", header: "Pincode" },
    { accessorKey: "locality", header: "Locality" },
  ];

  if (deleteLocationPermission || udpateLocationPermission) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const loc = row.original;
        return (
          <div className="text-right space-x-2">
            {udpateLocationPermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/locations/${loc.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {deleteLocationPermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(loc.id)}
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
          <CardTitle>Location List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={locations}
            searchPlaceholder="Search locations..."
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
            deleteMutation.mutate(`/api/locations/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
