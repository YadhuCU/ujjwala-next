"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { DomSaleCreateComponent } from "../components/dom-sale-create";

export default function AddDomSalePage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.DOMESTIC_SALE_CREATE}>
      <PageWrapper title="Add Domestic Sale" showBackButton>
        <DomSaleCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
