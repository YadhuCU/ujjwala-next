"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import PurchasesViewComponent from "./components/purchase-view";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

export default function PurchasesPage() {
  const { hasPermission } = usePermission();

  const createPurchasePermission = hasPermission(PERMISSIONS.PURCHASE_CREATE);

  return (
    <ProtectedPage requiredPermission={PERMISSIONS.PURCHASE_READ}>
      <PageWrapper
        title="Purchases"
        addButton={
          createPurchasePermission && (
            <Button asChild className="ml-auto">
              <Link href="/purchases/add">
                <Plus className="w-4 h-4 mr-2" />
                Add Purchase
              </Link>
            </Button>
          )
        }
      >
        <PurchasesViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
