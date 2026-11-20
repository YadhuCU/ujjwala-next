"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package } from "lucide-react";
import { DashboardData } from "./types";

// Batches running low, agency-wide. Its own card permission decides who sees
// it; the server sends nothing to anyone else.
export function LowStockCard({ data }: { data: DashboardData }) {
  const { lowStock, cards } = data;
  if (!cards.lowStock) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="text-warning h-5 w-5" />
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
  );
}
