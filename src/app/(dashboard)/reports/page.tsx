"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

// The sidebar has always linked /reports, but no page lived here. A report with
// a permission of its own only shows to those who hold it.
const REPORTS: {
  title: string;
  href: string;
  description: string;
  permission?: Permission;
}[] = [
  {
    title: "Commercial Sale Report",
    href: "/reports/commercial-sale",
    description: "Rentals and outright sales, with cylinders still outstanding.",
  },
  {
    title: "Domestic Sale Report",
    href: "/reports/dom-sale",
    description: "Field staff rounds: refills and outright sales.",
  },
  {
    title: "ARB Sale Report",
    href: "/reports/arb-sale",
    description: "Bulk gas and accessories.",
  },
  {
    title: "Product Wise Report",
    href: "/reports/product-wise",
    description:
      "Opening stock, purchases, sales, adjustments and closing stock per product.",
    permission: PERMISSIONS.REPORT_PRODUCT_WISE,
  },
  {
    title: "Customer Wise Report",
    href: "/reports/customer-wise",
    description:
      "Each customer's cylinders held and taken back, sales, receipts and balance.",
    permission: PERMISSIONS.REPORT_CUSTOMER_WISE,
  },
  {
    title: "Expense Report",
    href: "/reports/expense",
    description: "Spending over a date range.",
  },
  {
    title: "Purchase Report",
    href: "/reports/purchase",
    description: "Deliveries from vendors, by invoice.",
  },
];

export default function ReportsPage() {
  const { hasPermission } = usePermission();
  const visible = REPORTS.filter(
    (report) => !report.permission || hasPermission(report.permission),
  );

  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_READ}>
      <PageWrapper
        title="Reports"
        description="Each report covers a date range and can be exported to Excel or PDF."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((report) => (
            <Link key={report.href} href={report.href} className="group">
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {report.title}
                    <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-colors" />
                  </CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </PageWrapper>
    </ProtectedPage>
  );
}
