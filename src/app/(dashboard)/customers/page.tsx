"use client";

import { CustomerViewComponent } from "./components/customer-view";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function CustomersPage() {
  const { hasPermission } = usePermission();
  const customerCreatePermission = hasPermission(PERMISSIONS.CUSTOMER_CREATE);
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.CUSTOMER_READ}>
      <PageWrapper
        title="Customers"
        showBackButton
        addButton={
          customerCreatePermission && (
            <Button asChild className="ml-auto">
              <Link href="/customers/add">
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Link>
            </Button>
          )
        }
      >
        <CustomerViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
