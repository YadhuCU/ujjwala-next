"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardAlertsOptions } from "@/lib/query-options";

const DEFAULT_DAYS = 30;
const STORAGE_KEY = "dashboard.alert-days";

/** The viewer's own thresholds, remembered in this browser only. */
function readSavedDays(): { cylinderDays: number; paymentDays: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      cylinderDays: Number.isInteger(saved.cylinderDays) ? saved.cylinderDays : DEFAULT_DAYS,
      paymentDays: Number.isInteger(saved.paymentDays) ? saved.paymentDays : DEFAULT_DAYS,
    };
  } catch {
    return { cylinderDays: DEFAULT_DAYS, paymentDays: DEFAULT_DAYS };
  }
}

/**
 * Agency-wide customer alerts. "Too long" is the viewer's call — each of the
 * two overdue lists has its own number of days, typed into its header.
 */
export function CommercialAlerts() {
  const [days, setDays] = React.useState(() =>
    typeof window === "undefined"
      ? { cylinderDays: DEFAULT_DAYS, paymentDays: DEFAULT_DAYS }
      : readSavedDays(),
  );
  // What the inputs show; the query follows a moment after typing stops
  const [typed, setTyped] = React.useState(days);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (typed.cylinderDays === days.cylinderDays && typed.paymentDays === days.paymentDays)
        return;
      setDays(typed);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(typed));
      } catch {
        // Private windows can refuse storage; the thresholds still apply now
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [typed, days]);

  const { data, isLoading } = useQuery(
    dashboardAlertsOptions(days.cylinderDays, days.paymentDays),
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight">Commercial Sale Alerts</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AlertCard
          title="Pending Empty Cylinders"
          tone="text-warning"
          days={typed.cylinderDays}
          onDaysChange={(n) => setTyped((t) => ({ ...t, cylinderDays: n }))}
          loading={isLoading}
          empty="No pending cylinder issues"
          rows={(data?.pendingCylindersLong ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            figure: `${c.rentQty} pending`,
            note: c.neverReturned
              ? `None returned · held ${c.daysSinceLastReturn} days`
              : `Last return ${c.daysSinceLastReturn} days ago`,
          }))}
        />
        <AlertCard
          title="Pending Payments"
          tone="text-destructive"
          days={typed.paymentDays}
          onDaysChange={(n) => setTyped((t) => ({ ...t, paymentDays: n }))}
          loading={isLoading}
          empty="No pending payment issues"
          money
          rows={(data?.pendingPaymentLong ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            figure: `₹${c.pendingAmount.toLocaleString("en-IN")}`,
            note: c.neverPaid
              ? `Never paid · owed ${c.daysSinceLastPayment} days`
              : `Paid ${c.daysSinceLastPayment} days ago`,
          }))}
        />
        <AlertCard
          title="High Balance Accounts"
          tone="text-destructive"
          loading={isLoading}
          empty="No high balance accounts"
          money
          rows={(data?.highBalanceCustomers ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            figure: `₹${c.pendingAmount.toLocaleString("en-IN")}`,
            note: "High alert",
          }))}
        />
      </div>
    </div>
  );
}

function AlertCard({
  title,
  tone,
  days,
  onDaysChange,
  loading,
  empty,
  money = false,
  rows,
}: {
  title: string;
  tone: string;
  /** With a threshold, the header carries an "older than N days" input */
  days?: number;
  onDaysChange?: (days: number) => void;
  loading: boolean;
  empty: string;
  money?: boolean;
  rows: { id: number; name: string; phone: string; figure: string; note: string }[];
}) {
  const inputId = React.useId();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className={`h-4 w-4 ${tone}`} />
          {title}
        </CardTitle>
        {days !== undefined && onDaysChange && (
          <label
            htmlFor={inputId}
            className="text-muted-foreground flex items-center gap-2 text-xs"
          >
            Older than
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={0}
              max={3650}
              value={Number.isNaN(days) ? "" : days}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                // An empty box waits for a number rather than querying 0
                if (Number.isNaN(n)) return;
                onDaysChange(Math.min(3650, Math.max(0, Math.round(n))));
              }}
              className="h-8 w-20 tabular-nums"
            />
            days
          </label>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground py-4 text-center text-sm">{empty}</div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm leading-none font-medium">{row.name}</p>
                  <p className="text-muted-foreground text-xs">{row.phone}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`text-sm font-semibold tabular-nums ${money ? "text-destructive" : ""}`}
                  >
                    {row.figure}
                  </div>
                  <div className="text-muted-foreground text-xs">{row.note}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
