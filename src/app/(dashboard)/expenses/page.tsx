"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useDeleteMutation } from "@/hooks/use-api";
import { expensesOptions } from "@/lib/query-options";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

export default function ExpensesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: expenses = [] } = useQuery({
    ...expensesOptions,
  });

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.expenses.all],
    onSuccess: () => router.refresh(),
  });

  return (
    <PageWrapper
      title="Expenses"
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/expenses/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Expense List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((ex) => (
                <TableRow key={ex.id}>
                  <TableCell className="font-medium">{ex.expense}</TableCell>
                  <TableCell>
                    {ex.date
                      ? new Date(ex.date).toLocaleDateString("en-IN")
                      : ""}
                  </TableCell>
                  <TableCell>{ex.amount ? `₹${ex.amount}` : ""}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/expenses/${ex.id}/edit`}>
                            <Pencil className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(ex.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
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
            deleteMutation.mutate(`/api/expenses/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </PageWrapper>
  );
}
