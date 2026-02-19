"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { useCustomers, useUsers } from "@/hooks/use-api";
import { salesOptions } from "@/lib/query-options";

interface Customer { id: number; name: string | null }
interface StaffUser { id: number; name: string | null }
interface Sale {
  id: number; trNo: string | null; quantity: string | null; salePrice: string | null;
  netTotal: string | null; createdAt: string;
  customer: { id: number; name: string | null } | null;
  product: { name: string | null } | null;
  stock: { batchNo: string | null } | null;
}

export default function SaleReportPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const { data: customers = [] } = useCustomers() as { data: Customer[] };
  const { data: allUsers = [] } = useUsers() as { data: StaffUser[] };
  const staffUsers = isAdmin ? allUsers : [];

  const { data: allSales = [] } = useQuery({
    ...salesOptions,
    select: (data) => data as Sale[],
    enabled: searchTriggered,
  });

  const sales = useMemo(() => {
    let filtered = allSales;
    if (fromDate) filtered = filtered.filter(s => new Date(s.createdAt) >= new Date(fromDate));
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59);
      filtered = filtered.filter(s => new Date(s.createdAt) <= to);
    }
    if (customerId && customerId !== "all") {
      filtered = filtered.filter(s => s.customer && s.customer.id === parseInt(customerId));
    }
    return filtered;
  }, [allSales, fromDate, toDate, customerId]);

  function exportCSV() {
    const headers = ["TR No", "Customer", "Product", "Batch", "Qty", "Price", "Net Total", "Date"];
    const rows = sales.map(s => [
      s.trNo, s.customer?.name, s.product?.name, s.stock?.batchNo,
      s.quantity, s.salePrice, s.netTotal,
      new Date(s.createdAt).toLocaleDateString("en-IN"),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sale_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  const totalAmount = sales.reduce((sum, s) => sum + parseFloat(s.netTotal || "0"), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Sale Report</h1>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <div className="space-y-2"><Label>From Date</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>To Date</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Staff</Label>
                <Select value={staffId} onValueChange={setStaffId}>
                  <SelectTrigger><SelectValue placeholder="All Staff" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {staffUsers.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button onClick={() => setSearchTriggered(true)}><Search className="w-4 h-4 mr-2" />Search</Button>
              <Button variant="outline" onClick={exportCSV} disabled={sales.length === 0}><Download className="w-4 h-4 mr-2" />Export</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Results ({sales.length})</CardTitle>
            {sales.length > 0 && <div className="text-lg font-bold text-primary">Total: ₹{totalAmount.toLocaleString("en-IN")}</div>}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>TR No</TableHead><TableHead>Customer</TableHead><TableHead>Product</TableHead>
              <TableHead>Batch</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead>
              <TableHead>Net Total</TableHead><TableHead>Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Click Search to view results.</TableCell></TableRow>
              ) : sales.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.trNo}</TableCell>
                  <TableCell>{s.customer?.name}</TableCell>
                  <TableCell>{s.product?.name}</TableCell>
                  <TableCell>{s.stock?.batchNo}</TableCell>
                  <TableCell>{s.quantity}</TableCell>
                  <TableCell>{s.salePrice ? `₹${s.salePrice}` : ""}</TableCell>
                  <TableCell className="font-semibold">{s.netTotal ? `₹${s.netTotal}` : ""}</TableCell>
                  <TableCell>{new Date(s.createdAt).toLocaleDateString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
