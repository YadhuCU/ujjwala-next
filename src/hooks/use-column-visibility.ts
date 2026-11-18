"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Column id → false when the user has hidden it. Missing means shown. */
export type ColumnVisibility = Record<string, boolean>;

/**
 * Which columns a user has hidden on a table, remembered per page in this
 * browser. `/customer-txn/12` and `/customer-txn/40` share one setting — the
 * numeric segment is the record, not the page.
 *
 * The session gate in the dashboard layout means these tables never render on
 * the server, so reading storage in the initializer cannot cause a hydration
 * mismatch.
 */
export function useColumnVisibility(table = "table") {
  const pathname = usePathname();
  const key = `columns:${pathname.replace(/\/\d+(?=\/|$)/g, "/:id")}:${table}`;

  const [visibility, setVisibility] = useState<ColumnVisibility>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      // Nothing hidden is the default — no need to keep an entry for it
      if (Object.values(visibility).some((shown) => shown === false))
        window.localStorage.setItem(key, JSON.stringify(visibility));
      else window.localStorage.removeItem(key);
    } catch {
      // Storage can be blocked (private mode); the choice then lasts the visit
    }
  }, [key, visibility]);

  return [visibility, setVisibility] as const;
}
