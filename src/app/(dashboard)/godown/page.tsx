"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { GodownViewComponent } from "./components/godown-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.STOCK_READ}>
      <PageWrapper
        title="Godown"
        description="Filled and empty cylinders on hand, what customers are holding, and every movement behind the numbers."
      >
        <GodownViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
