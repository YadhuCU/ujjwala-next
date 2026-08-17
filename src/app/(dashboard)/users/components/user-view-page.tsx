"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/use-permissions";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { UserResponse } from "@/module/user/user.serializer";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { PageWrapper } from "@/components/page-wrapper";
import { PERMISSIONS } from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";
import { usersOptions } from "@/lib/query-options";
import { Badge } from "@/components/ui/badge";

export const UserViewPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Permissions arrive with the session, so these must not be frozen on first
  // render — hasPermission is the dependency.
  const hasUpdatePermission = useMemo(
    () => hasPermission(PERMISSIONS.USER_UPDATE),
    [hasPermission],
  );
  const hasDeletePermission = useMemo(
    () => hasPermission(PERMISSIONS.USER_DELETE),
    [hasPermission],
  );
  const hasCreatePermission = useMemo(
    () => hasPermission(PERMISSIONS.USER_CREATE),
    [hasPermission],
  );

  const { data: users = [] } = useSuspenseQuery({
    ...usersOptions,
  });

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.users.all],
    onSuccess: () => router.refresh(),
  });

  async function toggleActive(id: number, isActive: boolean) {
    await apiClient.patch(`/api/users/${id}`, { isActive: !isActive });
    toast.success(isActive ? "Disabled" : "Enabled");
    queryClient.invalidateQueries({ queryKey: [...queryKeys.users.all] });
  }

  const columns: ColumnDef<UserResponse>[] = [
    { accessorKey: "username", header: "Username" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "mobile", header: "Mobile" },
    {
      accessorKey: "userRoles",
      header: "Roles",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex gap-1 flex-wrap">
            {u.userRoles.map((r) => (
              <Badge variant="outline" key={r.id}>
                {r.name}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <Switch
            disabled={!hasUpdatePermission}
            checked={u.isActive}
            onCheckedChange={() =>
              hasUpdatePermission && toggleActive(u.id, u.isActive)
            }
            title="Enable/Disable User"
          />
        );
      },
    },
  ];

  if (hasDeletePermission || hasUpdatePermission) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="text-right space-x-2">
            {hasUpdatePermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/users/${u.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {hasDeletePermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(u.id)}
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
    <PageWrapper
      title="Users"
      showBackButton
      addButton={
        hasCreatePermission && (
          <Button asChild className="ml-auto">
            <Link href="/users/add">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Link>
          </Button>
        )
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={users}
            searchPlaceholder="Search users..."
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
            deleteMutation.mutate(`/api/users/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </PageWrapper>
  );
};
