"use client";

import { useCallback, useState } from "react";
import { format } from "date-fns";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const daysAgoStr = (n: number) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return format(date, "yyyy-MM-dd");
};

export const DATE_PRESETS = [
  { label: "Today", from: todayStr, to: todayStr },
  { label: "Last 7 Days", from: () => daysAgoStr(6), to: todayStr },
  { label: "Last 30 Days", from: () => daysAgoStr(29), to: todayStr },
] as const;

export const REPORT_PAGE_LIMIT = 10;

/**
 * Shared filter state for every report page: a date range with presets, a page
 * number, and the "has the user pressed Search yet" flag the queries hang off.
 */
export function useReportFilters() {
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const applyPreset = useCallback((index: number) => {
    const preset = DATE_PRESETS[index];
    setFromDate(preset.from());
    setToDate(preset.to());
    setActivePreset(index);
  }, []);

  // Picking a date by hand takes it out of any preset
  const pickFrom = useCallback((value: string) => {
    setFromDate(value);
    setActivePreset(-1);
  }, []);

  const pickTo = useCallback((value: string) => {
    setToDate(value);
    setActivePreset(-1);
  }, []);

  const search = useCallback(() => {
    setPage(1);
    setSearchTriggered(true);
  }, []);

  return {
    fromDate,
    toDate,
    activePreset,
    page,
    searchTriggered,
    setPage,
    applyPreset,
    pickFrom,
    pickTo,
    search,
  };
}

export type ReportFilters = ReturnType<typeof useReportFilters>;

export function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
