"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { stockAdjustmentsOptions } from "@/lib/query-options";
import { StockAdjustmentResponse } from "@/module/stock-adjustment/stock-adjustment.serializer";

function DeltaCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <span className={value < 0 ? "text-destructive" : "text-green-600"}>
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

/**
 * Adjustments are append-only — there is no edit or delete here by design. A
 * wrong adjustment is corrected by posting the opposite one.
 */
export function StockAdjustmentViewComponent() {
  const { data } = useSuspenseQuery(stockAdjustmentsOptions);

  const columns: ColumnDef<StockAdjustmentResponse>[] = [
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString("en-IN"),
    },
    {
      accessorKey: "product.name",
      header: "Product",
      cell: ({ row }) => (
        <span>
          {row.original.product.name}{" "}
          <Badge variant="outline">{row.original.product.type}</Badge>
        </span>
      ),
    },
    {
      accessorKey: "filledDelta",
      header: "Filled",
      cell: ({ row }) => <DeltaCell value={row.original.filledDelta} />,
    },
    {
      accessorKey: "emptyDelta",
      header: "Empty",
      cell: ({ row }) => <DeltaCell value={row.original.emptyDelta} />,
    },
    {
      accessorKey: "reason",
      header: "Reason",
    },
    {
      accessorKey: "createdBy.name",
      header: "Posted by",
      cell: ({ row }) => row.original.createdBy?.name ?? "—",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adjustment Log</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Search adjustments..."
        />
        <p className="text-muted-foreground mt-4 text-xs">
          Adjustments are permanent. To correct one, post the opposite
          adjustment — frequent entries here usually mean something upstream
          (a missing sale, a wrong purchase quantity) needs looking at.
        </p>
      </CardContent>
    </Card>
  );
}
