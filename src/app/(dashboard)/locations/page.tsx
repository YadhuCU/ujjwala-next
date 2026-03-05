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
import { useLocations, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

interface Location {
  id: number;
  name: string | null;
  district: string | null;
  pincode: string | null;
  locality: string | null;
}

export default function LocationsPage() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: locations = [] } = useLocations() as { data: Location[] };

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.locations.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<Location>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "district", header: "District" },
    { accessorKey: "pincode", header: "Pincode" },
    { accessorKey: "locality", header: "Locality" },
  ];

  if (isAdmin) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const loc = row.original;
        return (
          <div className="text-right space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/locations/${loc.id}/edit`}>
                <Pencil className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(loc.id)}
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
      title="Locations"
      showBackButton
      addButton={
        isAdmin && (
          <Button asChild className="ml-auto">
            <Link href="/locations/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Link>
          </Button>
        )
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Location List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={locations} searchPlaceholder="Search locations..." />
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
    </PageWrapper>
  );
}
