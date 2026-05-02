"use client";

import { useState, useCallback } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { format } from "date-fns";
import { CalendarIcon, Download, Search, FileSpreadsheet, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomers, useUsers } from "@/hooks/use-api";
import { useDomSaleReport } from "@/hooks/use-dom-sale-report";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function todayStr() { return format(new Date(), "yyyy-MM-dd"); }
function daysAgoStr(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return format(d, "yyyy-MM-dd"); }
const DATE_PRESETS = [
  { label: "Today", from: todayStr, to: todayStr },
  { label: "Last 7 Days", from: () => daysAgoStr(6), to: todayStr },
  { label: "Last 30 Days", from: () => daysAgoStr(29), to: todayStr },
] as const;
const PAGE_LIMIT = 10;
function formatCurrency(v: number) { return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
interface Customer { id: number; name: string | null; }
interface StaffUser { id: number; name: string | null; }

export default function DomSaleReportPage() {
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [activePreset, setActivePreset] = useState(0);
  const [customerId, setCustomerId] = useState("all");
  const [staffId, setStaffId] = useState("all");
  const [page, setPage] = useState(1);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { isAdmin } = usePermissions();
  const { data: customers = [] } = useCustomers() as { data: Customer[] };
  const { data: allUsers = [] } = useUsers() as { data: StaffUser[] };
  const staffUsers = isAdmin ? allUsers : [];
  const queryParams = { from: fromDate, to: toDate, customerId: customerId !== "all" ? customerId : undefined, staffId: staffId !== "all" ? staffId : undefined, page, limit: PAGE_LIMIT };
  const { data: report, isLoading, isFetching } = useDomSaleReport(queryParams, searchTriggered);
  const summary = report?.summary;
  const sales = report?.data ?? [];
  const pagination = report?.pagination;

  const handlePreset = useCallback((idx: number) => {
    const preset = DATE_PRESETS[idx];
    setFromDate(preset.from()); setToDate(preset.to()); setActivePreset(idx);
  }, []);

  function handleSearch() { setPage(1); setSearchTriggered(true); }

  async function handleExport(exportFormat: "excel" | "pdf") {
    if (!fromDate || !toDate) return;
    setExporting(true);
    try {
      await api.exportDomSaleReport({ from: fromDate, to: toDate, customerId: customerId !== "all" ? customerId : undefined, staffId: staffId !== "all" ? staffId : undefined, format: exportFormat });
      toast.success(`Report exported as ${exportFormat === "excel" ? "Excel" : "PDF"}`);
    } catch { toast.error("Export failed"); } finally { setExporting(false); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Domestic Sale Report</h1>
      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {DATE_PRESETS.map((p, idx) => (
              <Button key={p.label} variant={activePreset === idx ? "default" : "outline"} size="sm" onClick={() => handlePreset(idx)}>{p.label}</Button>
            ))}
          </div>
          <div className={cn("grid grid-cols-1 gap-4", isAdmin ? "md:grid-cols-5" : "md:grid-cols-4")}>
            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(new Date(fromDate), "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fromDate ? new Date(fromDate) : undefined} onSelect={(d) => { if (d) { setFromDate(format(d, "yyyy-MM-dd")); setActivePreset(-1); } }} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(new Date(toDate), "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={toDate ? new Date(toDate) : undefined} onSelect={(d) => { if (d) { setToDate(format(d, "yyyy-MM-dd")); setActivePreset(-1); } }} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
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
                    {staffUsers.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full md:w-auto"><Search className="mr-2 h-4 w-4" />Search</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {searchTriggered && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard title="Total Invoices" value={summary?.invoiceCount} format={(v) => String(v)} loading={isLoading} />
          <SummaryCard title="Total Amount" value={summary?.totalSubtotal} format={formatCurrency} loading={isLoading} />
          <SummaryCard title="Total Discount" value={summary?.totalDiscount} format={formatCurrency} loading={isLoading} />
          <SummaryCard title="Net Total" value={summary?.totalNetTotal} format={formatCurrency} loading={isLoading} highlight />
        </div>
      )}

      {searchTriggered && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Results {pagination && <span className="text-sm font-normal text-muted-foreground">({pagination.total} records)</span>}</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={sales.length === 0 || exporting}>
                    <Download className="mr-2 h-4 w-4" />{exporting ? "Exporting…" : "Export"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Export as Excel</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")}><FileText className="mr-2 h-4 w-4" />Export as PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Products (Qty)</TableHead>
                  <TableHead>Batches</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Net Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : sales.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No results found for the selected filters.</TableCell></TableRow>
                ) : (
                  sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.trNo}</TableCell>
                      <TableCell>{new Date(s.createdAt).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell>{s.customer?.name ?? "—"}</TableCell>
                      <TableCell>{s.createdBy?.name ?? "—"}</TableCell>
                      <TableCell>{s.items.map((i) => `${i.product?.name ?? ""} (${i.quantity})`).join(", ")}</TableCell>
                      <TableCell>{s.items.map((i) => i.stock?.batchNo ?? "").filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell className="text-right">{s.totalAmount ? `₹${s.totalAmount}` : "—"}</TableCell>
                      <TableCell className="text-right">{s.discount ? `₹${s.discount}` : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">₹{(Number(s.totalAmount ?? 0) - Number(s.discount ?? 0)).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1 || isFetching} onClick={() => setPage(pagination.page - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || isFetching} onClick={() => setPage(pagination.page + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ title, value, format: fmt, loading, highlight }: { title: string; value: number | undefined; format: (v: number) => string; loading: boolean; highlight?: boolean; }) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        {loading ? <Skeleton className="mt-1 h-7 w-24" /> : <p className={cn("text-2xl font-bold", highlight && "text-primary")}>{value != null ? fmt(value) : "—"}</p>}
      </CardContent>
    </Card>
  );
}
