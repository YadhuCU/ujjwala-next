"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
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
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

interface Sale {
  id: number;
  trNo: string | null;
  quantity: string | null;
  salePrice: string | null;
  netTotal: string | null;
  createdAt: string;
  stock: { batchNo: string | null } | null;
  customer: { name: string | null } | null;
  product: { name: string | null } | null;
}

export function SalesClient({ sales }: { sales: Sale[] }) {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.sales.all],
    onSuccess: () => router.refresh(),
  });

  return (
    <PageWrapper
      title="Commercial Sales"
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/sales/add">
            <Plus className="w-4 h-4 mr-2" />
            New Sale
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TR No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Net Total</TableHead>
                <TableHead>Date</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    No sales found.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.trNo}</TableCell>
                    <TableCell>{s.customer?.name}</TableCell>
                    <TableCell>{s.product?.name}</TableCell>
                    <TableCell>{s.stock?.batchNo}</TableCell>
                    <TableCell>{s.quantity}</TableCell>
                    <TableCell>
                      {s.salePrice ? `₹${s.salePrice}` : ""}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {s.netTotal ? `₹${s.netTotal}` : ""}
                    </TableCell>
                    <TableCell>
                      {new Date(s.createdAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/sales/${s.id}/edit`}>
                              <Pencil className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(s.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
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
            deleteMutation.mutate(`/api/sales/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </PageWrapper>
  );
}
