import { cn } from "@/lib/utils";

/**
 * The foot of an entry form: what the document comes to, and the buttons that
 * save or abandon it. Display only — the server recomputes every total.
 */
export function FormSummary({
  label,
  amount,
  detail,
  children,
  className,
}: {
  label: string;
  amount: number;
  /** A line under the figure: a breakdown, or who collects it. */
  detail?: React.ReactNode;
  /** The form's own submit and cancel buttons, unchanged. */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted/50 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs sm:text-[13px]">{label}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums">
          ₹
          {amount.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        {detail && (
          <div className="text-muted-foreground mt-0.5 text-xs">{detail}</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row-reverse">
        {children}
      </div>
    </div>
  );
}
