"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Package, Plus } from "lucide-react";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

type Action = {
  label: string;
  href: string;
  permission: Permission;
  variant?: "default" | "secondary" | "outline";
  icon?: "plus" | "package" | "report";
};

// Offering an action the user cannot perform just sends them to a 403
const ACTIONS: Action[] = [
  {
    label: "New Commercial Sale",
    href: "/commercial-sales/add",
    permission: PERMISSIONS.COMMERCIAL_SALE_CREATE,
  },
  {
    label: "New Domestic Sale",
    href: "/dom-sales/add",
    permission: PERMISSIONS.DOMESTIC_SALE_CREATE,
    variant: "secondary",
  },
  {
    label: "New ARB Sale",
    href: "/arb-sales/add",
    permission: PERMISSIONS.ARB_SALE_CREATE,
    variant: "secondary",
  },
  {
    label: "Add Expense",
    href: "/expenses/add",
    permission: PERMISSIONS.EXPENSE_CREATE,
    variant: "outline",
  },
  {
    label: "New Purchase",
    href: "/purchases/add",
    permission: PERMISSIONS.PURCHASE_CREATE,
    variant: "outline",
  },
  {
    label: "Manage Stock",
    href: "/stock",
    permission: PERMISSIONS.STOCK_READ,
    variant: "outline",
    icon: "package",
  },
  {
    label: "Reports",
    href: "/reports/commercial-sale",
    permission: PERMISSIONS.REPORT_READ,
    variant: "outline",
    icon: "report",
  },
];

export function QuickActions() {
  const { hasPermission } = usePermission();
  const actions = ACTIONS.filter((action) => hasPermission(action.permission));

  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          {actions.map((action) => (
            <Button
              key={action.href}
              asChild
              variant={action.variant ?? "default"}
              className="h-auto min-h-11 justify-start gap-2 px-3 py-2 text-left text-[13px] leading-tight whitespace-normal sm:min-h-9 sm:justify-center sm:text-sm"
            >
              <Link href={action.href}>
                <Icon kind={action.icon} />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Icon({ kind }: { kind?: Action["icon"] }) {
  const className = "w-4 h-4 sm:mr-2";

  if (kind === "package") return <Package className={className} />;
  if (kind === "report") return <FileText className={className} />;
  return <Plus className={className} />;
}
