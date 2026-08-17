"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/use-permissions";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { useApiMutation, useStocks } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { DataTable } from "@/components/data-table";
import { PERMISSIONS } from "@/lib/permissions";
import { ColumnDef } from "@tanstack/react-table";
import { StockResponse } from "@/module/stock/stock.serializer";

export function StockViewComponent() {
  const router = useRouter();

  const { hasPermission } = usePermission();
  const updatePermission = hasPermission(PERMISSIONS.STOCK_UPDATE);
  const deletePermission = hasPermission(PERMISSIONS.STOCK_DELETE);

  // The stock page shows drained batches too, unlike the sale forms
  const { data } = useStocks(undefined, true);

  const [deleteTarget, setDeleteTarget] = useState<StockResponse | null>(null);

  const columns: ColumnDef<StockResponse>[] = [
    { accessorKey: "batchNo", header: "Batch No" },
    {
      accessorKey: "product.name",
      header: "Product",
      cell: ({ row }) => row.original.product?.name ?? "—",
    },
    {
      accessorKey: "vendor.name",
      header: "Vendor",
      cell: ({ row }) => row.original.vendor?.name ?? "—",
    },
    {
      accessorKey: "invoiceNo",
      header: "Invoice No",
      cell: ({ row }) => row.original.invoiceNo ?? "—",
    },
    {
      accessorKey: "quantity",
      header: "Available Qty",
      cell: ({ row }) => (
        <span
          className={row.original.quantity === 0 ? "text-muted-foreground" : ""}
        >
          {row.original.quantity}
        </span>
      ),
    },
    {
      accessorKey: "productCost",
      header: "Cost",
      cell: ({ row }) =>
        row.original.productCost !== undefined
          ? `₹${Number(row.original.productCost).toFixed(2)}`
          : "—",
    },
    {
      id: "source",
      header: "Source",
      cell: ({ row }) =>
        row.original.isManual ? (
          <Badge variant="outline">Manual</Badge>
        ) : (
          <Link
            href={`/purchases/${row.original.purchaseId}/edit`}
            className="underline underline-offset-4"
          >
            Purchase #{row.original.purchaseId}
          </Link>
        ),
    },
  ];

  if (updatePermission || deletePermission) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const stock = row.original;

        // Purchase batches are owned by their purchase — edit it there
        if (!stock.isManual) {
          return (
            <div className="text-right text-xs text-muted-foreground">
              Edit via purchase
            </div>
          );
        }

        return (
          <div className="text-right space-x-2">
            {updatePermission && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/stock/${stock.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
            )}
            {deletePermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(stock)}
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
          <CardTitle>Stock Batches</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data}
            searchPlaceholder="Search batches..."
          />
        </CardContent>
      </Card>

      <DeleteStockDialog
        stock={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => router.refresh()}
      />
    </>
  );
}

type DeleteStockDialogProps = {
  stock: StockResponse | null;
  onClose: () => void;
  onDeleted: () => void;
};

/**
 * Deleting a batch takes its remaining cylinders back out of the godown, so it
 * is recorded as a stock adjustment and needs a reason.
 */
function DeleteStockDialog({
  stock,
  onClose,
  onDeleted,
}: DeleteStockDialogProps) {
  const [reason, setReason] = useState("");

  const deleteMutation = useApiMutation({
    url: `/api/stock/${stock?.id}`,
    method: "DELETE",
    invalidateKeys: [queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Stock batch deleted");
      setReason("");
      onClose();
      onDeleted();
    },
  });

  return (
    <Dialog
      open={stock !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete batch {stock?.batchNo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {stock?.quantity ? (
              <>
                {stock.quantity} cylinder(s) will be removed from the godown as
                a stock adjustment.
              </>
            ) : (
              <>This batch is empty — nothing will move in the godown.</>
            )}
          </p>

          <div className="space-y-2">
            <Label htmlFor="delete-reason">Reason</Label>
            <Input
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Batch entered twice by mistake"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="destructive"
              disabled={reason.trim().length === 0}
              isLoading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ reason })}
            >
              Delete
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
