"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { CommercialSaleCreateComponent } from "../components/commercial-sale-create";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.COMMERCIAL_SALE_CREATE}>
      <PageWrapper title="Add Commercial Sale" showBackButton>
        <CommercialSaleCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
