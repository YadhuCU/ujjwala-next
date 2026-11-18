"use client";

import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ColumnOption = {
  id: string;
  label: string;
  visible: boolean;
};

/**
 * "Columns" menu: tick the columns to show. Used by every list and report
 * table, so hiding the empty ones works the same everywhere. At least one
 * column always stays, so the table can never go blank.
 */
export function ColumnPicker({
  columns,
  onToggle,
  onShowAll,
}: {
  columns: ColumnOption[];
  onToggle: (id: string, visible: boolean) => void;
  onShowAll: () => void;
}) {
  const shown = columns.filter((column) => column.visible).length;
  const hidden = columns.length - shown;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-md:h-10">
          <Columns3 className="h-4 w-4" />
          Columns
          {hidden > 0 && (
            <span className="text-muted-foreground tabular-nums">
              ({shown}/{columns.length})
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.visible}
            disabled={column.visible && shown === 1}
            // Keep the menu open so several columns can be toggled in a row
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => onToggle(column.id, checked === true)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        {hidden > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onShowAll}>Show all</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
