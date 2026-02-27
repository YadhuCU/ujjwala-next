"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, Search, FileSpreadsheet, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaleByProductReport } from "@/hooks/use-sale-by-product-report";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return format(d, "yyyy-MM-dd");
}

const DATE_PRESETS = [
  { label: "Today", from: todayStr, to: todayStr },
  { label: "Last 7 Days", from: () => daysAgoStr(6), to: todayStr },
  { label: "Last 30 Days", from: () => daysAgoStr(29), to: todayStr },
] as const;

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SaleByProductReportPage() {
  // Filter state
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [activePreset, setActivePreset] = useState(0); // 0 = Today
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Query params object
  const queryParams = {
    from: fromDate,
    to: toDate,
  };

  const { data: report, isLoading } = useSaleByProductReport(queryParams, searchTriggered);

  const summary = report?.summary;
  const products = report?.data ?? [];

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handlePreset = useCallback((idx: number) => {
    const preset = DATE_PRESETS[idx];
    setFromDate(preset.from());
    setToDate(preset.to());
    setActivePreset(idx);
  }, []);

  function handleSearch() {
    setSearchTriggered(true);
  }

  async function handleExport(exportFormat: "excel" | "pdf") {
    if (!fromDate || !toDate) return;
    setExporting(true);
    try {
      await api.exportSaleByProductReport({
        from: fromDate,
        to: toDate,
        format: exportFormat,
      });
      toast.success(`Report exported as ${exportFormat === "excel" ? "Excel" : "PDF"}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Sale By Product</h1>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Presets */}
          <div className="flex items-center gap-2">
            {DATE_PRESETS.map((preset, idx) => (
              <Button
                key={preset.label}
                variant={activePreset === idx ? "default" : "outline"}
                size="sm"
                onClick={() => handlePreset(idx)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Filter inputs */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            {/* From Date */}
            <div className="space-y-2 flex-grow md:max-w-[200px]">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate
                      ? format(new Date(fromDate), "dd MMM yyyy")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate ? new Date(fromDate) : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setFromDate(format(d, "yyyy-MM-dd"));
                        setActivePreset(-1);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date */}
            <div className="space-y-2 flex-grow md:max-w-[200px]">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate
                      ? format(new Date(toDate), "dd MMM yyyy")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate ? new Date(toDate) : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setToDate(format(d, "yyyy-MM-dd"));
                        setActivePreset(-1);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Search */}
            <Button onClick={handleSearch} className="w-full md:w-auto mt-4 md:mt-0">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      {searchTriggered && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
          <SummaryCard
            title="Total Quantity"
            value={summary?.totalQuantity}
            format={(v) => String(v)}
            loading={isLoading}
          />
          <SummaryCard
            title="Total Amount"
            value={summary?.totalAmount}
            format={formatCurrency}
            loading={isLoading}
            highlight
          />
        </div>
      )}

      {/* ── Results Table ─────────────────────────────────────────────── */}
      {searchTriggered && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Results</CardTitle>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={products.length === 0 || exporting}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exporting ? "Exporting…" : "Export"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("excel")}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: 3 }).map((_, cIdx) => (
                        <TableCell key={cIdx}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No results found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-right">{p.totalQuantity}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {p.totalAmount ? `₹${p.totalAmount}` : "0.00"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  format: fmt,
  loading,
  highlight,
}: {
  title: string;
  value: number | undefined;
  format: (v: number) => string;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-24" />
        ) : (
          <p
            className={cn(
              "text-2xl font-bold",
              highlight && "text-primary"
            )}
          >
            {value != null ? fmt(value) : "—"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
