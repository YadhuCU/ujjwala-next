"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { rangeLabel, type DashboardView, type PeriodSelection } from "./period";

const VIEWS: { value: DashboardView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Day, Month or Year, and the range within it. The range shown is the one the
 * server resolved (`from` / `to`), so a month view always reads as whole months.
 */
export function PeriodPicker({
  view,
  from,
  to,
  onChange,
}: {
  view: DashboardView;
  from: string;
  to: string;
  onChange: (next: PeriodSelection) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <div
        role="group"
        aria-label="Period"
        className="bg-muted grid grid-cols-3 rounded-lg p-1 sm:inline-grid"
      >
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={view === option.value}
            // A fresh view starts on its own default range
            onClick={() => option.value !== view && onChange({ view: option.value })}
            className={cn(
              "focus-visible:ring-ring rounded-md px-4 py-1.5 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
              view === option.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === "day" ? (
        <DayRange from={from} to={to} onChange={onChange} />
      ) : (
        <GridRange view={view} from={from} to={to} onChange={onChange} />
      )}
    </div>
  );
}

function DayRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: PeriodSelection) => void;
}) {
  // Local while picking: the first click alone is not a range yet
  const [draft, setDraft] = React.useState<DateRange | undefined>();
  const shown = draft ?? { from: parseISO(from), to: parseISO(to) };

  return (
    <DateRangePicker
      dateRange={shown}
      onDateRangeChange={(range) => {
        setDraft(range);
        if (range?.from && range.to) {
          setDraft(undefined);
          onChange({
            view: "day",
            // The calendar date picked, never toISOString() (see CLAUDE.md)
            from: format(range.from, "yyyy-MM-dd"),
            to: format(range.to, "yyyy-MM-dd"),
          });
        }
      }}
    />
  );
}

/**
 * Months or years on a grid: the first click starts the range, the second ends
 * it. Picking the same cell twice is a single month or year.
 */
function GridRange({
  view,
  from,
  to,
  onChange,
}: {
  view: "month" | "year";
  from: string;
  to: string;
  onChange: (next: PeriodSelection) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [start, setStart] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const endYear = Number(to.slice(0, 4));
  // Month grid pages by year; year grid by twelve-year page
  const [page, setPage] = React.useState(endYear);

  // Every opening starts clean, on the page holding the current end
  const openPicker = (next: boolean) => {
    if (next) {
      setStart(null);
      setHover(null);
      setPage(view === "month" ? endYear : endYear - 10);
    }
    setOpen(next);
  };

  const cells =
    view === "month"
      ? MONTHS.map((label, i) => ({
          key: `${page}-${String(i + 1).padStart(2, "0")}`,
          label,
        }))
      : Array.from({ length: 12 }, (_, i) => ({
          key: String(page - 1 + i),
          label: String(page - 1 + i),
        }));

  const cut = (key: string) => (view === "month" ? key.slice(0, 7) : key.slice(0, 4));
  const lo = start ? [start, hover ?? start].sort()[0] : cut(from);
  const hi = start ? [start, hover ?? start].sort()[1] : cut(to);

  const pick = (key: string) => {
    if (!start) {
      setStart(key);
      return;
    }
    const [a, b] = [start, key].sort();
    setOpen(false);
    onChange(
      view === "month"
        ? { view, from: `${a}-01`, to: `${b}-01` }
        : { view, from: `${a}-01-01`, to: `${b}-12-31` },
    );
  };

  const step = view === "month" ? 1 : 12;

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal sm:w-[230px]"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {rangeLabel(view, from, to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="mb-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={view === "month" ? "Previous year" : "Earlier years"}
            onClick={() => setPage((p) => p - step)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">
            {view === "month" ? page : `${page - 1} – ${page + 10}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={view === "month" ? "Next year" : "Later years"}
            onClick={() => setPage((p) => p + step)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1" onMouseLeave={() => setHover(null)}>
          {cells.map((cell) => {
            const edge = cell.key === lo || cell.key === hi;
            const inside = cell.key > lo && cell.key < hi;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => pick(cell.key)}
                onMouseEnter={() => start && setHover(cell.key)}
                className={cn(
                  "focus-visible:ring-ring h-9 rounded-md text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  edge
                    ? "bg-primary text-primary-foreground font-semibold"
                    : inside
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-muted",
                )}
              >
                {cell.label}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          {start
            ? `Now pick the last ${view}.`
            : `Pick the first ${view}, then the last.`}
        </p>
      </PopoverContent>
    </Popover>
  );
}
