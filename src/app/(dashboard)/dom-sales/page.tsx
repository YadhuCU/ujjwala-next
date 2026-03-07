"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
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
import { domSalesOptions } from "@/lib/query-options";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

export default function DomSalesPage() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: response } = useQuery(domSalesOptions);
  // Handle both old array format and new paginated format
  const domSales = (Array.isArray(response) ? response : ((response as any)?.data || [])) as any[];

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.domSales.all],
    onSuccess: () => router.refresh(),
  });

  return (
    <PageWrapper
      title="Domestic Sales"
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/dom-sales/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Sale
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Domestic Sales List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tr No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Date</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {domSales.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.trNo}</TableCell>
                  <TableCell>{s.customer?.name || "Walk-in"}</TableCell>
                  <TableCell>
                    {s.items?.length > 0 ? (
                      <div className="text-sm">
                        {s.items.map((item: any, idx: number) => (
                          <div key={idx}>
                            {item.product?.name} x {item.quantity}
                          </div>
                        ))}
                      </div>
                    ) : (
                      "No items"
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{s.paymentType}</TableCell>
                  <TableCell>
                    {s.totalAmount ? `₹${Number(s.totalAmount).toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(s.createdAt).toLocaleDateString("en-IN")}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dom-sales/${s.id}/edit`}>
                            <Pencil className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(s.id)}
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
            deleteMutation.mutate(`/api/dom-sales/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </PageWrapper>
  );
}
