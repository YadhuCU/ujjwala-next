"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { DeleteAlert } from "@/components/delete-alert";
import { ColumnDef } from "@tanstack/react-table";
import { useApiMutation } from "@/hooks/use-api";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import {
  customerTransactionsOptions,
  customerTxnOptions,
} from "@/lib/query-options";
import { LedgerEntryType } from "@/generated/enums";
import { LedgerEntryResponse } from "@/module/customer-txn/customer-txn.serializer";
import { RecordPaymentDialog } from "./record-payment-dialog";

const ALL = "all";

export function CustomerTxnViewComponent() {
  const params = useParams();
  const customerId = params.id as string;

  const { hasPermission } = usePermission();
  const canManagePayments = hasPermission(PERMISSIONS.CUSTOMER_UPDATE);

  const [entryType, setEntryType] = useState<string>(ALL);
  const [reverseId, setReverseId] = useState<number | null>(null);

  const { data: summary } = useSuspenseQuery(customerTxnOptions(customerId));

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    ...customerTransactionsOptions(customerId, {
      ...(entryType !== ALL && { entryType }),
      limit: 100,
    }),
    select: (res) => res.data,
  });

  const reverseMutation = useApiMutation({
    url: `/api/customer-txn/${customerId}/payments/${reverseId}`,
    method: "DELETE",
    invalidateKeys: [queryKeys.customerTxn.all, queryKeys.customers.all],
    onSuccess: () => {
      toast.success("Payment reversed");
      setReverseId(null);
    },
  });

  const columns: ColumnDef<LedgerEntryResponse>[] = [
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString("en-IN"),
    },
    {
      accessorKey: "entryType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.entryType}</Badge>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = row.original.amount;
        // Positive adds to what the customer owes, negative pays it down
        return (
          <span className={amount < 0 ? "text-green-600" : ""}>
            {amount < 0 ? "−" : "+"}₹{Math.abs(amount).toFixed(2)}
          </span>
        );
      },
    },
    {
      accessorKey: "refType",
      header: "Reference",
      cell: ({ row }) => `${row.original.refType} #${row.original.refId}`,
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => row.original.notes ?? "—",
    },
    {
      accessorKey: "createdBy.name",
      header: "Recorded by",
      cell: ({ row }) => row.original.createdBy?.name ?? "—",
    },
  ];

  if (canManagePayments) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const entry = row.original;

        // Only payments can be reversed — charges are undone by editing the
        // invoice they came from.
        if (entry.entryType !== LedgerEntryType.PAYMENT) return null;

        return (
          <div className="text-right">
            <Button
              variant="ghost"
              size="icon"
              title="Reverse this payment"
              onClick={() => setReverseId(entry.id)}
            >
              <Undo2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        );
      },
    });
  }

  const pendingCylinders = summary.pendingCylinders;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold tabular-nums sm:text-3xl ${
                summary.pendingAmount > 0 ? "text-destructive" : ""
              }`}
            >
              ₹{Number(summary.pendingAmount).toFixed(2)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Sum of every entry on the ledger below.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cylinders With Customer</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingCylinders.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No cylinders outstanding.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {pendingCylinders.map((ledger) => (
                  <li key={ledger.id}>
                    <span className="font-medium">{ledger.product.name}</span>
                    {" • "}
                    {ledger.pendingCylinder} cylinder
                    {ledger.pendingCylinder > 1 ? "s" : ""}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <CardTitle>Transaction History</CardTitle>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            <Select value={entryType} onValueChange={setEntryType}>
              <SelectTrigger className="min-w-0 flex-1 sm:w-[180px] sm:flex-none">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {Object.values(LedgerEntryType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManagePayments && (
              <RecordPaymentDialog customerId={customerId} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Without this the table shows its "no results" empty state while the
              first page is still loading, which reads as "this customer has no
              history" */}
          {transactionsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={transactions ?? []}
              searchPlaceholder="Search transactions..."
            />
          )}
        </CardContent>
      </Card>

      <DeleteAlert
        open={reverseId !== null}
        onOpenChange={(open) => {
          if (!open) setReverseId(null);
        }}
        onConfirm={() => reverseMutation.mutate({})}
        isPending={reverseMutation.isPending}
      />
    </div>
  );
}
