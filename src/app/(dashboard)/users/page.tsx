"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUsers, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { PageWrapper } from "@/components/page-wrapper";

export default function UsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: users = [] } = useUsers();

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.users.all],
    onSuccess: () => router.refresh(),
  });

  async function toggleActive(id: number, isActive: boolean) {
    await apiClient.patch(`/api/users/${id}`, { isActive: !isActive });
    toast.success(isActive ? "Disabled" : "Enabled");
    queryClient.invalidateQueries({ queryKey: [...queryKeys.users.all] });
  }

  const columns: ColumnDef<any>[] = [
    { accessorKey: "username", header: "Username" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "mobile", header: "Mobile" },
    { accessorKey: "role", header: "Role" },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <Badge
            variant={u.isActive ? "default" : "secondary"}
            className={isAdmin ? "cursor-pointer" : ""}
            onClick={() => isAdmin && toggleActive(u.id, u.isActive)}
          >
            {u.isActive ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
  ];

  if (isAdmin) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="text-right space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/users/${u.id}/edit`}>
                <Pencil className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(u.id)}
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
      title="Users"
      showBackButton
      addButton={
        isAdmin && (
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
          <DataTable columns={columns} data={users} searchPlaceholder="Search users..." />
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
}
