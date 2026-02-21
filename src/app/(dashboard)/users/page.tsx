"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUsers, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { PageWrapper } from "@/components/page-wrapper";

export default function UsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.mobile}</TableCell>
                  <TableCell>{u.usertype?.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.isActive ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => isAdmin && toggleActive(u.id, u.isActive)}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-2">
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
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
