"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { godownStatusOptions } from "@/lib/query-options";

/**
 * The first thing on the dashboard: how many cylinders exist and where they
 * are. Unlike the rest of the dashboard this is not scoped to the person
 * looking — the godown holds what it holds, whoever is asking.
 */
export function GodownPreview() {
  const { data, isLoading } = useQuery(godownStatusOptions);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { rows, totals } = data;
  const owned = totals.filledQty + totals.emptyQty + totals.withCustomers;

  // A preview, not the full page: busiest products first, nothing empty, and a
  // hard cap so the dashboard below stays reachable however many products exist
  const PREVIEW_ROWS = 5;
  const ranked = [...rows]
    .filter((row) => row.filledQty + row.emptyQty + row.withCustomers > 0)
    .sort(
      (a, b) =>
        b.filledQty + b.withCustomers - (a.filledQty + a.withCustomers),
    );
  const shown = ranked.slice(0, PREVIEW_ROWS);
  const hidden = ranked.length - shown.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-blue-500" />
            Godown
          </CardTitle>
          <CardDescription>
            {owned} cylinder{owned === 1 ? "" : "s"} owned, across{" "}
            {rows.length} product{rows.length === 1 ? "" : "s"}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/godown" className="text-xs">
            Full view <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {totals.outOfSync > 0 && (
          <Link
            href="/godown"
            className="border-destructive/40 bg-destructive/5 text-destructive flex items-center gap-2 rounded border px-3 py-2 text-sm"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {totals.outOfSync} product
            {totals.outOfSync === 1 ? "" : "s"} no longer match the cylinder
            ledger — open the godown to see which.
          </Link>
        )}

        {shown.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {rows.length === 0
              ? "No cylinder products yet. Domestic and commercial products appear here once they exist."
              : "No cylinders on hand or with customers yet."}
          </p>
        ) : (
          <div className="divide-border divide-y border-t pt-1">
            {shown.map((row) => (
              <div
                key={row.productId}
                className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0 truncate font-medium">
                  {row.productName}
                </span>
                <span className="text-muted-foreground flex shrink-0 items-center gap-3 tabular-nums">
                  <span>
                    <b className="text-foreground">{row.filledQty}</b> filled
                  </span>
                  <span>{row.emptyQty} empty</span>
                  {row.withCustomers > 0 && (
                    <Badge variant="outline">{row.withCustomers} out</Badge>
                  )}
                </span>
              </div>
            ))}

            {hidden > 0 && (
              <Link
                href="/godown"
                className="text-muted-foreground hover:text-foreground block py-2 text-sm"
              >
                +{hidden} more product{hidden === 1 ? "" : "s"}
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

