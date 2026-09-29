"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { permissionCatalogueOptions } from "@/lib/query-options";
import { SCOPES } from "@/lib/permissions";

// A module read with no scope beside it grants nothing — the service refuses
// the query rather than quietly showing an empty list. Warn rather than let an
// administrator save a role that cannot work.
const SCOPE_GATES = [
  { gate: "expense.read", label: "Expenses", ...SCOPES.EXPENSE },
  { gate: "report.read", label: "Reports", ...SCOPES.REPORT },
  { gate: "dashboard.read", label: "Dashboard", ...SCOPES.DASHBOARD },
];

export function PermissionMatrix({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { data: catalogue } = useSuspenseQuery(permissionCatalogueOptions);

  const held = useMemo(() => new Set(value), [value]);

  const toggle = (code: string) => {
    const next = new Set(held);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange([...next]);
  };

  const setModule = (codes: string[], on: boolean) => {
    const next = new Set(held);
    for (const code of codes) {
      if (on) next.add(code);
      else next.delete(code);
    }
    onChange([...next]);
  };

  const missingScopes = SCOPE_GATES.filter(
    (entry) => held.has(entry.gate) && !held.has(entry.own) && !held.has(entry.all),
  );

  const allCodes = catalogue.flatMap((group) =>
    group.permissions.map((permission) => permission.code),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          <b className="text-foreground tabular-nums">{held.size}</b> of{" "}
          {allCodes.length} permissions granted
        </p>

        {!disabled && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(allCodes)}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {missingScopes.length > 0 && (
        <div className="border-amber-500/40 bg-amber-500/5 flex items-start gap-2 rounded border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">
              {missingScopes.map((entry) => entry.label).join(", ")}:{" "}
              no visibility chosen
            </p>
            <p className="text-muted-foreground">
              This role can open the module but will see nothing. Tick either
              &ldquo;own records only&rdquo; or the agency-wide option.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {catalogue.map((group) => {
          const codes = group.permissions.map((permission) => permission.code);
          const granted = codes.filter((code) => held.has(code)).length;
          const allOn = granted === codes.length;
          const someOn = granted > 0 && !allOn;

          return (
            <section
              key={group.module}
              className="rounded-lg border"
              aria-label={group.module}
            >
              <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{group.module}</h3>
                  {granted > 0 && (
                    <Badge variant="outline" className="tabular-nums">
                      {granted}/{codes.length}
                    </Badge>
                  )}
                </div>

                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setModule(codes, !allOn)}
                  >
                    {allOn ? (
                      <>
                        <Minus className="mr-1 h-3 w-3" />
                        None
                      </>
                    ) : (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        All
                      </>
                    )}
                    {someOn && <span className="sr-only">partially selected</span>}
                  </Button>
                )}
              </header>

              <ul className="divide-border divide-y">
                {group.permissions.map((permission) => (
                  <li key={permission.code}>
                    <label
                      className={`flex items-start gap-3 px-3 py-2 ${
                        disabled ? "cursor-not-allowed" : "hover:bg-muted/40 cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        checked={held.has(permission.code)}
                        onCheckedChange={() => toggle(permission.code)}
                        disabled={disabled}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm">{permission.label}</span>
                        {permission.description && (
                          <span className="text-muted-foreground block text-xs">
                            {permission.description}
                          </span>
                        )}
                        <code className="text-muted-foreground/70 block text-[11px]">
                          {permission.code}
                        </code>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
