import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { Cell, ColumnDef, Table as TanstackTable } from "@tanstack/react-table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  actionButton?: React.ReactNode;
  pageSize?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search all columns...",
  actionButton,
  pageSize = 10
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = React.useState("");

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns an unmemoizable instance by design
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      globalFilter
    }
  });
  React.useEffect(() => {
    if (table) {
      table.setPageSize(pageSize);
    }
  }, [table, pageSize]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 py-4">
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter ?? ""}
          onChange={event => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />
        {actionButton}
      </div>
      <MobileRows table={table} />
      <div className="hidden overflow-hidden rounded border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead
                      key={header.id}
                      className={header.column.columnDef.meta?.className}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center py-4 text-sm font-medium whitespace-nowrap">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>

        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            className="max-md:h-10 max-md:px-4"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="max-md:h-10 max-md:px-4"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

// A table as wide as most of these would hide its right-hand columns — the
// edit and delete buttons included — off the side of a phone. Below `md` every
// row is a card instead: the first column is its title, the actions sit
// top-right where a thumb reaches them, and the rest read as label / value.
function MobileRows<TData>({ table }: { table: TanstackTable<TData> }) {
  const rows = table.getRowModel().rows;
  const headers = table.getFlatHeaders();

  if (!rows.length) {
    return (
      <p className="text-muted-foreground rounded border py-10 text-center text-sm md:hidden">
        No results.
      </p>
    );
  }

  const label = (cell: Cell<TData, unknown>) => {
    const header = headers.find(h => h.column.id === cell.column.id);
    return header && !header.isPlaceholder
      ? flexRender(cell.column.columnDef.header, header.getContext())
      : null;
  };

  // A blank value only adds a row of label with nothing beside it
  const isBlank = (cell: Cell<TData, unknown>) => {
    if (!cell.column.accessorFn) return false;
    const value = cell.getValue();
    return value === null || value === undefined || value === "";
  };

  return (
    <ul className="space-y-3 md:hidden">
      {rows.map(row => {
        const cells = row.getVisibleCells();
        const actions = cells.find(cell => cell.column.id === "actions");
        const [title, ...details] = cells.filter(
          cell => cell.column.id !== "actions"
        );

        return (
          <li key={row.id} className="bg-card rounded-lg border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 pt-2 font-semibold break-words">
                {title &&
                  flexRender(title.column.columnDef.cell, title.getContext())}
              </div>
              {actions && (
                <div className="-mr-1 shrink-0 [&>div]:flex [&>div]:space-x-0">
                  {flexRender(
                    actions.column.columnDef.cell,
                    actions.getContext()
                  )}
                </div>
              )}
            </div>
            {details.length > 0 && (
              <dl className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 border-t pt-2">
                {details
                  .filter(cell => !isBlank(cell))
                  .map(cell => (
                    <React.Fragment key={cell.id}>
                      <dt className="text-muted-foreground">{label(cell)}</dt>
                      <dd className="min-w-0 text-right break-words [&_*]:justify-end [&_*]:text-right">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </dd>
                    </React.Fragment>
                  ))}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
