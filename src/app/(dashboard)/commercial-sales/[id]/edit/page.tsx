"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { CommercialSaleUpdateComponent } from "../../components/commercial-sale-update";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.COMMERCIAL_SALE_UPDATE}>
      <PageWrapper title="Edit Commercial Sale" showBackButton>
        <CommercialSaleUpdateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
