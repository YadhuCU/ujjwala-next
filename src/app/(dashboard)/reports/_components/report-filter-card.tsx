"use client";

import { ReactNode } from "react";
import { format } from "date-fns";
import { CalendarIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DATE_PRESETS, type ReportFilters } from "./use-report-filters";

type ReportFilterCardProps = {
  filters: ReportFilters;
  /** Extra selects — customer, staff, vendor — rendered between the dates and Search. */
  children?: ReactNode;
};

export function ReportFilterCard({ filters, children }: ReportFilterCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          {DATE_PRESETS.map((preset, index) => (
            <Button
              key={preset.label}
              variant={filters.activePreset === index ? "default" : "outline"}
              size="sm"
              className="max-sm:h-9 max-sm:px-1.5 max-sm:text-[13px]"
              onClick={() => filters.applyPreset(index)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <DateField
            label="From Date"
            value={filters.fromDate}
            onChange={filters.pickFrom}
          />
          <DateField
            label="To Date"
            value={filters.toDate}
            onChange={filters.pickTo}
          />

          {children}

          <div className="col-span-2 flex items-end md:col-span-1">
            <Button onClick={filters.search} className="w-full md:w-auto">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start px-3 text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(new Date(value), "dd MMM yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(date) => date && onChange(format(date, "yyyy-MM-dd"))}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** An "All / …" dropdown filter, the shape every report's extra filters take. */
export function ReportSelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: number; name?: string | null }[];
  allLabel?: string;
}) {
  return (
    <div className="col-span-2 space-y-2 md:col-span-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
