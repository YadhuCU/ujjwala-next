"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, ShoppingCart, ArrowUpRight } from "lucide-react";
import { DashboardData } from "./types";

export function InventoryAndTransactions({ data }: { data: DashboardData }) {
  const { lowStock, recentTxns, scope } = data;
  // Low stock is an agency-wide figure, not scoped to the viewer.
  const hideAgencyWide = scope !== "all";

  return (
    <div className={`grid grid-cols-1 gap-6 ${hideAgencyWide ? "" : "lg:grid-cols-2"}`}>
      {/* Low Stock Alert (admin only) */}
      {!hideAgencyWide && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Low Stock Alert
            </CardTitle>
            <CardDescription>Products with quantity below 10</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">All stock levels are healthy</p>
              </div>
            ) : (
              <>
              <ul className="divide-y md:hidden">
                {lowStock.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.productName}</p>
                      <p className="text-muted-foreground truncate font-mono text-xs">
                        {s.batchNo}
                      </p>
                    </div>
                    <Badge
                      variant={s.quantity <= 3 ? "destructive" : "secondary"}
                      className="shrink-0 tabular-nums"
                    >
                      {s.quantity}
                    </Badge>
                  </li>
                ))}
              </ul>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.batchNo}
                      </TableCell>
                      <TableCell>{s.productName}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            s.quantity <= 3 ? "destructive" : "secondary"
                          }
                          className="tabular-nums"
                        >
                          {s.quantity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              Recent Transactions
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/commercial-sales" className="text-xs">
                View All <ArrowUpRight className="ml-1 w-3 h-3" />
              </Link>
            </Button>
          </div>
          <CardDescription>Latest sales across every type</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTxns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <>
            <ul className="divide-y md:hidden">
              {recentTxns.map((t) => (
                <li key={`${t.type}-${t.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.customer}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      <span className="font-mono">{t.trNo}</span> · {t.product}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    ₹{t.amount.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>TR No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTxns.map((t) => (
                  // Ids are only unique per sale model, so the type qualifies them
                  <TableRow key={`${t.type}-${t.id}`}>
                    <TableCell className="font-medium font-mono text-xs">
                      {t.trNo}
                    </TableCell>
                    <TableCell>{t.customer}</TableCell>
                    <TableCell>{t.product}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ₹{t.amount.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
