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
  const { lowStock, recentTxns, role } = data;
  const isStaff = role === "staff";

  return (
    <div className={`grid gap-6 ${isStaff ? "" : "lg:grid-cols-2"}`}>
      {/* Low Stock Alert (admin only) */}
      {!isStaff && (
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
              <Table>
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
              <Link href="/sales" className="text-xs">
                View All <ArrowUpRight className="ml-1 w-3 h-3" />
              </Link>
            </Button>
          </div>
          <CardDescription>Latest commercial sales</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTxns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <Table>
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
                  <TableRow key={t.id}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
