"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { ARBSaleCreateComponent } from "../components/arb-sale-create";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.ARB_SALE_CREATE}>
      <PageWrapper title="Add ARB Sale" showBackButton>
        <ARBSaleCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
