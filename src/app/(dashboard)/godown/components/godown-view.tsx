"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Cylinder, PackageOpen, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  godownMovementsOptions,
  godownStatusOptions,
} from "@/lib/query-options";
import { TxnType } from "@/generated/enums";

const ALL = "all";

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_FULL: "New full cylinders in",
  PURCHASE_FILL: "Refilled by vendor",
  SALE_OUT: "Sold out",
  RENT_DELIVERY: "Dispatched on rent",
  CYLINDER_RETURN: "Empties returned",
  ADJUSTMENT: "Manual adjustment",
};

export function GodownViewComponent() {
  const { data: status } = useSuspenseQuery(godownStatusOptions);
  const [txnType, setTxnType] = useState(ALL);

  const { data: movements, isLoading: movementsLoading } = useQuery(
    godownMovementsOptions({
      ...(txnType !== ALL && { txnType }),
      limit: 25,
    }),
  );

  const { rows, totals } = status;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Filled in godown"
          value={totals.filledQty}
          icon={<Cylinder className="h-4 w-4" />}
          hint="Ready to sell or dispatch"
        />
        <SummaryCard
          title="Empty in godown"
          value={totals.emptyQty}
          icon={<PackageOpen className="h-4 w-4" />}
          hint="Waiting to go back for refill"
        />
        <SummaryCard
          title="With customers"
          value={totals.withCustomers}
          icon={<Users className="h-4 w-4" />}
          hint="Rented out, expected back"
        />
        <SummaryCard
          title="Total cylinders"
          value={totals.filledQty + totals.emptyQty + totals.withCustomers}
          hint="Everything the agency owns"
          highlight
        />
      </div>

      {/* The cache is only ever derived from the ledger, so a mismatch means
          something wrote one without the other — worth shouting about. */}
      {totals.outOfSync > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {totals.outOfSync} product(s) disagree with the cylinder ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            The godown count is a running total of the cylinder ledger below. A
            difference means a movement was recorded in one place but not the
            other, and the ledger is the one to trust.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Godown by product</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Filled</TableHead>
                  <TableHead className="text-right">Empty</TableHead>
                  <TableHead className="text-right">With customers</TableHead>
                  <TableHead className="text-right">Sellable stock</TableHead>
                  <TableHead>Ledger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No cylinder products yet. Only domestic and commercial
                      products appear here — ARB and other stock is tracked by
                      batch on the{" "}
                      <Link href="/stock" className="underline">
                        stock page
                      </Link>
                      .
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell className="font-medium">
                        {row.productName}
                        {row.weight ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {row.weight}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {row.filledQty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.emptyQty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.withCustomers > 0 ? row.withCustomers : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.batchQty}
                        <span className="text-muted-foreground text-xs">
                          {" · "}
                          {row.batchCount}{" "}
                          {row.batchCount === 1 ? "batch" : "batches"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.inSync ? (
                          <Badge variant="outline">in sync</Badge>
                        ) : (
                          <Badge variant="destructive">
                            ledger says {row.ledgerFilled} / {row.ledgerEmpty}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-muted-foreground mt-4 text-xs">
            &ldquo;Sellable stock&rdquo; is batch quantity, which is what a sale
            draws from; the filled count is what the godown physically holds.
            They move together on a normal sale and drift apart only through a
            manual correction.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Cylinder movements</CardTitle>
          <div className="flex items-center gap-3">
            <Select value={txnType} onValueChange={setTxnType}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All movements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All movements</SelectItem>
                {Object.values(TxnType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {MOVEMENT_LABELS[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <Link href="/stock-adjustments/add">Post adjustment</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {movementsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Movement</TableHead>
                    <TableHead className="text-right">Filled</TableHead>
                    <TableHead className="text-right">Empty</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(movements ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No cylinder movements recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (movements ?? []).map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {new Date(movement.createdAt).toLocaleDateString(
                            "en-IN",
                          )}
                        </TableCell>
                        <TableCell>{movement.product.name}</TableCell>
                        <TableCell>
                          {MOVEMENT_LABELS[movement.txnType] ??
                            movement.txnType}
                          {movement.voidedTxnId ? (
                            <Badge variant="outline" className="ml-2">
                              reversal
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Delta value={movement.filledDelta} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Delta value={movement.emptyDelta} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {movement.refType} #{movement.refId}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs">
                          {movement.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <span className={value < 0 ? "text-destructive" : "text-green-600"}>
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  hint,
  icon,
  highlight,
}: {
  title: string;
  value: number;
  hint: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-3xl font-bold tabular-nums ${highlight ? "text-primary" : ""}`}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}
