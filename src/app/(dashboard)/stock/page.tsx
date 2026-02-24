"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useStocks, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";

interface Product {
  id: number;
  name: string | null;
}
interface Stock {
  id: number;
  batchNo: string | null;
  invoiceNo: string | null;
  quantity: string | null;
  productCost: string | null;
  salePrice: string | null;
  product: Product | null;
  productId: number | null;
}

export default function StockPage() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rawStocks = [] } = useStocks();
  const stocks = rawStocks as Stock[];

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.stocks.all],
    onSuccess: () => router.refresh(),
  });

  return (
    <PageWrapper
      title="Stock"
      addButton={
        isAdmin && (
          <Button asChild className="ml-auto">
            <Link href="/stock/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Stock
            </Link>
          </Button>
        )
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Stock List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch No</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Invoice No</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Sale Price</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocks.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.batchNo}</TableCell>
                  <TableCell>{s.product?.name}</TableCell>
                  <TableCell>{s.invoiceNo}</TableCell>
                  <TableCell>{s.quantity}</TableCell>
                  <TableCell>
                    {s.productCost ? `₹${s.productCost}` : ""}
                  </TableCell>
                  <TableCell>{s.salePrice ? `₹${s.salePrice}` : ""}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/stock/${s.id}/edit`}>
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
            deleteMutation.mutate(`/api/stock/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </PageWrapper>
  );
}
