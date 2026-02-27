"use client";

import { useArbSales } from "@/hooks/use-api";
import { PageWrapper } from "@/components/page-wrapper";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import { useState } from "react";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { DeleteAlert } from "@/components/delete-alert";

export default function ArbSalesPage() {
  const { data: arbSales = [], isLoading } = useArbSales();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = useApiMutation({
    url: deleteId ? `/api/arb-sales/${deleteId}` : "",
    method: "DELETE",
    invalidateKeys: [queryKeys.arbSales.all, queryKeys.stocks.all],
  });

  return (
    <PageWrapper
      title="ARB Sales"
      description="List of all multi-product ARB sales."
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/arb-sales/add">
            <Plus className="w-4 h-4 mr-2" /> Add ARB Sale
          </Link>
        </Button>
      }
    >
      <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TR No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : arbSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No ARB sales found.
                </TableCell>
              </TableRow>
            ) : (
              arbSales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.trNo || "-"}</TableCell>
                  <TableCell>
                    {format(new Date(s.createdAt), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>{s.customer?.name || "-"}</TableCell>
                  <TableCell className="capitalize">{s.paymentType}</TableCell>
                  <TableCell>₹{Number(s.totalAmount || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/arb-sales/${s.id}/edit`}>
                        <Eye className="w-4 h-4" />
                      </Link>
                    </Button>
                    {isAdmin && !s.isDeleted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(s.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DeleteAlert
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate({});
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </PageWrapper>
  );
}
