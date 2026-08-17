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
import { PERMISSIONS } from "@/lib/permissions";

// The sidebar has always linked /reports, but no page lived here.
const REPORTS = [
  {
    title: "Commercial Sale Report",
    href: "/reports/commercial-sale",
    description: "Rentals and outright sales, with cylinders still outstanding.",
  },
  {
    title: "Domestic Sale Report",
    href: "/reports/dom-sale",
    description: "Cylinder sales to domestic customers.",
  },
  {
    title: "ARB Sale Report",
    href: "/reports/arb-sale",
    description: "Bulk gas and accessories.",
  },
  {
    title: "Sale by Product Report",
    href: "/reports/sale-by-product",
    description: "All three sale types rolled up by product.",
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
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_READ}>
      <PageWrapper
        title="Reports"
        description="Each report covers a date range and can be exported to Excel or PDF."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((report) => (
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
