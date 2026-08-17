"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePermission } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";
import { useDeleteMutation } from "@/hooks/use-api";
import { expensesOptions } from "@/lib/query-options";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { DataTable } from "@/components/data-table";
import { PERMISSIONS } from "@/lib/permissions";
import { ColumnDef } from "@tanstack/react-table";
import { ExpenseResponse } from "@/module/expense/expense.serializer";

export function ExpensesViewComponent() {
  const router = useRouter();

  const { hasPermission } = usePermission();
  const updatePermission = hasPermission(PERMISSIONS.EXPENSE_UPDATE);
  const deletePermission = hasPermission(PERMISSIONS.EXPENSE_DELETE);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data } = useSuspenseQuery(expensesOptions);

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.expenses.all],
    onSuccess: () => router.refresh(),
  });

  const columns: ColumnDef<ExpenseResponse>[] = [
    {
      accessorKey: "expense",
      header: "Expense",
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) =>
        row.original.date
          ? new Date(row.original.date).toLocaleDateString("en-IN")
          : "—",
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => `₹${Number(row.original.amount).toFixed(2)}`,
    },
    {
      accessorKey: "createdBy.name",
      header: "Recorded by",
      cell: ({ row }) => row.original.createdBy?.name ?? "—",
    },
  ];

  if (updatePermission || deletePermission) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const expense = row.original;
        return (
          <div className="text-right space-x-2">
            {updatePermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/expenses/${expense.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {deletePermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(expense.id)}
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
          <CardTitle>Expense List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data}
            searchPlaceholder="Search Expenses..."
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
            deleteMutation.mutate(`/api/expenses/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
