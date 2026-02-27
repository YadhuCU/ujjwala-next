"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseForm } from "../../components/purchase-form";
import type { PurchaseFormValues } from "../../components/purchase-form";
import { PageWrapper } from "@/components/page-wrapper";

interface PurchaseProduct {
  id: number;
  name: string | null;
}

interface PurchaseItemDetail {
  id: number;
  productId: number;
  product: PurchaseProduct;
  batchNo: string;
  quantity: number;
  unitCost: string | number | null;
  totalCost: string | number | null;
}

interface PurchaseVendor {
  id: number;
  name: string;
}

interface PurchaseDetail {
  id: number;
  invoiceNo: string | null;
  vendorId: number;
  vendor: PurchaseVendor;
  totalAmount: string | number | null;
  purchaseDate: string;
  notes: string | null;
  items: PurchaseItemDetail[];
}

export default function EditPurchasePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: purchase, isLoading } = useQuery({
    queryKey: queryKeys.purchases.detail(id),
    queryFn: () => api.getById<PurchaseDetail>("purchases", id),
    enabled: !!id,
  });

  const updateMutation = useApiMutation({
    url: `/api/purchases/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.purchases.all],
    onSuccess: () => {
      toast.success("Purchase updated");
      router.push("/purchases");
    },
  });

  if (isLoading || !purchase) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading purchase...</p>
      </div>
    );
  }

  const formDefaults: PurchaseFormValues = {
    vendorId: String(purchase.vendorId),
    invoiceNo: purchase.invoiceNo || "",
    purchaseDate: purchase.purchaseDate
      ? new Date(purchase.purchaseDate).toISOString().split("T")[0]
      : "",
    notes: purchase.notes || "",
    items: purchase.items.map((item) => ({
      productId: String(item.productId),
      batchNo: item.batchNo,
      quantity: item.quantity,
      unitCost: item.unitCost != null ? Number(item.unitCost) : 0,
    })),
  };

  return (
    <PageWrapper title="View / Edit Purchase" showBackButton>
      {/* Header edit form (vendor is read-only) */}
      <PurchaseForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(v: PurchaseFormValues & { totalAmount: number }) =>
          updateMutation.mutate(v)
        }
        isPending={updateMutation.isPending}
      />

      {/* Read-only items table */}
      <Card className="container mr-auto mt-6">
        <CardHeader>
          <CardTitle>Purchase Items (read-only)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Batch No</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.product?.name}</TableCell>
                  <TableCell>{item.batchNo}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    {item.unitCost != null
                      ? `₹${Number(item.unitCost).toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {item.totalCost != null
                      ? `₹${Number(item.totalCost).toFixed(2)}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
