"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReportPagination } from "@/module/report/report.serializer";

// ─── Summary cards ───────────────────────────────────────────────────────────

export type SummaryTile = {
  title: string;
  value: number | undefined;
  format?: (value: number) => string;
  highlight?: boolean;
};

export function ReportSummary({
  tiles,
  isLoading,
}: {
  tiles: SummaryTile[];
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.title} className={tile.highlight ? "border-primary" : ""}>
          <CardContent className="pt-6 max-sm:pt-0">
            <p className="text-muted-foreground text-xs sm:text-sm">{tile.title}</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-24" />
            ) : (
              <p
                className={cn(
                  "text-lg font-bold break-words tabular-nums sm:text-2xl",
                  tile.highlight && "text-primary",
                )}
              >
                {tile.value != null
                  ? (tile.format ?? String)(tile.value)
                  : "—"}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Results table ───────────────────────────────────────────────────────────

export type ReportColumn<T> = {
  header: string;
  align?: "right";
  cell: (row: T) => React.ReactNode;
};

type ReportResultsProps<T> = {
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  pagination?: ReportPagination;
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  /** Runs the module's export helper; the card owns the pending state. */
  onExport: (format: "excel" | "pdf") => Promise<void>;
  /**
   * What the total counts. Defaults to records; the sale reports show a row per
   * item, so there the total is invoices and saying "records" would not match
   * the rows on screen.
   */
  countNoun?: string;
};

export function ReportResults<T>({
  columns,
  rows,
  rowKey,
  pagination,
  isLoading,
  isFetching,
  onPageChange,
  onExport,
  countNoun = "records",
}: ReportResultsProps<T>) {
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: "excel" | "pdf") {
    setExporting(true);
    try {
      await onExport(format);
      toast.success(
        `Report exported as ${format === "excel" ? "Excel" : "PDF"}`,
      );
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="leading-snug">
            Results{" "}
            {pagination && (
              <span className="text-muted-foreground text-sm font-normal">
                ({pagination.total} {countNoun})
              </span>
            )}
          </CardTitle>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={rows.length === 0 || exporting}
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
        <MobileResults
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          isLoading={isLoading}
        />
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.header}
                    className={column.align === "right" ? "text-right" : ""}
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((column) => (
                      <TableCell key={column.header}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-muted-foreground py-8 text-center"
                  >
                    No results found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={rowKey(row)}>
                    {columns.map((column) => (
                      <TableCell
                        key={column.header}
                        className={column.align === "right" ? "text-right" : ""}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || isFetching}
                onClick={() => onPageChange(pagination.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || isFetching}
                onClick={() => onPageChange(pagination.page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Eleven columns do not fit a phone. Each row becomes a card instead: the
// first column (the document number, the product) is its title, the last — the
// money, in every report — sits opposite it, and the rest read as label /
// value. Cells with nothing to say ("—", or money held back for the invoice's
// first line) are left out rather than listed empty.
function MobileResults<T>({
  columns,
  rows,
  rowKey,
  isLoading,
}: Pick<ReportResultsProps<T>, "columns" | "rows" | "rowKey" | "isLoading">) {
  if (isLoading) {
    return (
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm md:hidden">
        No results found for the selected filters.
      </p>
    );
  }

  const [first, ...rest] = columns;
  const last = rest.length > 0 ? rest[rest.length - 1] : undefined;
  const middle = last ? rest.slice(0, -1) : rest;
  const isEmpty = (node: React.ReactNode) =>
    node === null || node === undefined || node === "" || node === "—";

  return (
    <ul className="space-y-3 md:hidden">
      {rows.map((row) => {
        const trailing = last?.cell(row);
        return (
          <li key={rowKey(row)} className="rounded-lg border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-semibold break-words">
                {first?.cell(row)}
              </span>
              {!isEmpty(trailing) && (
                <span className="shrink-0 font-semibold tabular-nums">
                  {trailing}
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5">
              {middle.map((column) => {
                const value = column.cell(row);
                if (isEmpty(value)) return null;
                return (
                  <div key={column.header} className="contents">
                    <dt className="text-muted-foreground">{column.header}</dt>
                    <dd className="min-w-0 text-right break-words">{value}</dd>
                  </div>
                );
              })}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
