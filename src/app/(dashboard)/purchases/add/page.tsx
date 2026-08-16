"use client";

import CreatePurchaseComponent from "../components/purchase-create";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";

export default function AddPurchasePage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.PURCHASE_CREATE}>
      <PageWrapper title="Add Purchase" showBackButton>
        <CreatePurchaseComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
