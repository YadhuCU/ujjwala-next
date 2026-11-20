"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, ReceiptText, Trash2 } from "lucide-react";
import { useCustomers, useDeleteMutation } from "@/hooks/use-api";
import { DeleteAlert } from "@/components/delete-alert";
import { queryKeys } from "@/lib/query-keys";
import { CustomerResponse } from "@/module/customer/customer.serializer";
import { PERMISSIONS } from "@/lib/permissions";

export function CustomerViewComponent() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const customerDeletePermission = hasPermission(PERMISSIONS.CUSTOMER_DELETE);
  const customerUpdatePermission = hasPermission(PERMISSIONS.CUSTOMER_UPDATE);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = useDeleteMutation({
    invalidateKeys: [queryKeys.customers.all],
    onSuccess: () => router.refresh(),
  });

  const { data: customers } = useCustomers();

  const columns: ColumnDef<CustomerResponse>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "phone", header: "Phone" },
    // What they owe and hold, so nobody has to open each ledger to find out
    {
      accessorKey: "pendingAmount",
      header: "Pending Amount",
      // Right-aligned in the table only; on a phone the card aligns values
      meta: { className: "md:text-right" },
      cell: ({ row }) => {
        const amount = row.original.pendingAmount ?? 0;
        const rupees = `₹${Math.abs(amount).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
        })}`;
        // Paid more than they owed: money the agency holds for them
        if (amount < 0)
          return (
            <div className="text-right text-emerald-700 tabular-nums dark:text-emerald-400">
              {rupees} credit
            </div>
          );
        return (
          <div
            className={`text-right tabular-nums ${
              amount > 0
                ? "text-destructive font-semibold"
                : "text-muted-foreground"
            }`}
          >
            {rupees}
          </div>
        );
      },
    },
    {
      id: "pendingCylinders",
      header: "Pending Cylinders",
      meta: { className: "md:min-w-32 md:whitespace-normal" },
      // Searchable as text, e.g. "19 kg"
      accessorFn: (customer) =>
        (customer.pendingCylinders ?? [])
          .map((c) => `${c.productName} ${c.quantity}`)
          .join(" "),
      cell: ({ row }) => {
        const held = row.original.pendingCylinders ?? [];
        if (held.length === 0)
          return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col gap-0.5">
            {held.map((c) => (
              <span key={c.productId}>
                {c.productName}{" "}
                {/* The count stays with its "×" when the name wraps */}
                <span className="font-semibold whitespace-nowrap tabular-nums">
                  × {c.quantity}
                </span>
              </span>
            ))}
          </div>
        );
      },
    },
    { accessorKey: "location.name", header: "Location" },
    {
      accessorKey: "address",
      header: "Address",
      // Wraps, so one long address cannot push the actions off the table
      meta: { className: "md:min-w-36 md:max-w-48 md:whitespace-normal" },
    },
    {
      accessorKey: "discount",
      header: "Discount",
      cell: ({ row }) => {
        const d = row.original.discount;
        return d ? `₹${d.toLocaleString("en-IN")}` : "";
      },
    },
  ];

  // Every row action in one column. The ledger is read-only, so it shows to
  // anyone who can see the list; edit and delete follow their permissions.
  columns.push({
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const c = row.original;
      return (
        <div className="text-right space-x-2 whitespace-nowrap">
          <Button variant="ghost" size="icon" asChild title="Ledger">
            <Link href={`/customer-txn/${c.id}`} aria-label="Ledger">
              <ReceiptText className="w-4 h-4" />
            </Link>
          </Button>
          {customerUpdatePermission && (
            <Button variant="ghost" size="icon" asChild title="Edit">
              <Link href={`/customers/${c.id}/edit`} aria-label="Edit">
                <Pencil className="w-4 h-4" />
              </Link>
            </Button>
          )}
          {customerDeletePermission && (
            <Button
              variant="ghost"
              size="icon"
              title="Delete"
              aria-label="Delete"
              onClick={() => setDeleteId(c.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      );
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={customers}
            searchPlaceholder="Search customers..."
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
            deleteMutation.mutate(`/api/customers/${deleteId}`);
            setDeleteId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
