"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { UpdatePurchaseComponent } from "../../components/purchase-update";

export default function EditPurchasePage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.PURCHASE_UPDATE}>
      <PageWrapper title="Edit Purchase" showBackButton>
        <UpdatePurchaseComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
