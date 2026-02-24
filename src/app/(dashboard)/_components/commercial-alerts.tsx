"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { DashboardData } from "./types";

export function CommercialAlerts({ data }: { data: DashboardData }) {
  const { commercialAnalytics, role } = data;
  
  if (role !== "Owner") return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight">Commercial Sale Alerts</h2>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Missing Empty Cylinders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Pending Empty Cylinders ({">"} 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commercialAnalytics.pendingCylindersLong.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No pending cylinder issues
              </div>
            ) : (
              <div className="space-y-4">
                {commercialAnalytics.pendingCylindersLong.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {c.rentQty} pending
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.daysSinceLastReturn > 10000
                          ? "Never returned"
                          : `${c.daysSinceLastReturn} days ago`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Missing Payment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Pending Payments ({">"} 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commercialAnalytics.pendingPaymentLong.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No pending payment issues
              </div>
            ) : (
              <div className="space-y-4">
                {commercialAnalytics.pendingPaymentLong.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-rose-600">
                        ₹{c.pendingAmount.toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.daysSinceLastPayment > 10000
                          ? "No payment"
                          : `${c.daysSinceLastPayment} days ago`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* High Balance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              High Balance Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commercialAnalytics.highBalanceCustomers.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No high balance accounts
              </div>
            ) : (
              <div className="space-y-4">
                {commercialAnalytics.highBalanceCustomers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-red-600">
                        ₹{c.pendingAmount.toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        High alert
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
