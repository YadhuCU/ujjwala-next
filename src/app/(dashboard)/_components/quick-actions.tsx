"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/sales/add">
              <Plus className="w-4 h-4 mr-2" />
              New Commercial Sale
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dom-sales/add">
              <Plus className="w-4 h-4 mr-2" />
              New Domestic Sale
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/arb-sales/add">
              <Plus className="w-4 h-4 mr-2" />
              New ARB Sale
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/expenses/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/purchases/add">
              <Plus className="w-4 h-4 mr-2" />
              New Purchase
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/stock">
              <Package className="w-4 h-4 mr-2" />
              Manage Stock
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
