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
import { domSalesOptions } from "@/lib/query-options";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

interface DomSale {
  id: number;
  trNo: string | null;
  quantity: string | null;
  salePrice: string | null;
  collectionAmount: string | null;
  netTotal: string | null;
  createdAt: string;
  stock: { batchNo: string | null } | null;
  batchNo: string | null;
  product: { name: string | null } | null;
  name: string | null;
}

export default function DomSalesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: domSales = [] } = useQuery({
    ...domSalesOptions,
    select: (data) => data as DomSale[],
  });

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
                <TableHead>Product</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Net Total</TableHead>
                <TableHead>Date</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {domSales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.trNo}</TableCell>
                  <TableCell>{s.product?.name || s.name}</TableCell>
                  <TableCell>{s.stock?.batchNo || s.batchNo}</TableCell>
                  <TableCell>{s.quantity}</TableCell>
                  <TableCell>{s.salePrice ? `₹${s.salePrice}` : ""}</TableCell>
                  <TableCell>
                    {s.collectionAmount ? `₹${s.collectionAmount}` : ""}
                  </TableCell>
                  <TableCell>{s.netTotal ? `₹${s.netTotal}` : ""}</TableCell>
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
