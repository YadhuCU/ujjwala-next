"use client";

import { useState } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { DeleteAlert } from "@/components/delete-alert";
import { useDeleteMutation } from "@/hooks/use-api";
import { usePermission } from "@/hooks/use-permissions";
import { queryKeys } from "@/lib/query-keys";
import { roleListOptions } from "@/lib/query-options";
import { PERMISSIONS } from "@/lib/permissions";
import type { RoleResponse } from "@/module/role/role.serializer";

export function RoleViewComponent() {
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission(PERMISSIONS.ROLE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ROLE_DELETE);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data } = useSuspenseQuery(roleListOptions());
  const roles = data.data;

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.roles.all],
  });

  const columns: ColumnDef<RoleResponse>[] = [
    {
      accessorKey: "name",
      header: "Role",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.isSystem && (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              system
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.description ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "permissionCount",
      header: () => <div className="text-right">Permissions</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.permissionCount}
        </div>
      ),
    },
    {
      accessorKey: "userCount",
      header: () => <div className="text-right">Users</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.userCount > 0 ? row.original.userCount : "—"}
        </div>
      ),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const role = row.original;

        // A system role is deliberately immutable — show why rather than
        // rendering buttons that will be refused.
        if (role.isSystem) {
          return (
            <div className="text-muted-foreground text-right text-xs">
              always full access
            </div>
          );
        }

        return (
          <div className="space-x-2 text-right">
            {canUpdate && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/roles/${role.id}/edit`} aria-label="Edit role">
                  <Pencil className="h-4 w-4" />
                </Link>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete role"
                onClick={() => setDeleteId(role.id)}
              >
                <Trash2 className="text-destructive h-4 w-4" />
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
        <CardContent className="pt-6">
          <DataTable columns={columns} data={roles} />
        </CardContent>
      </Card>

      <DeleteAlert
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) deleteMutation.mutate(`/api/roles/${deleteId}`);
          setDeleteId(null);
        }}
      />
    </>
  );
}
