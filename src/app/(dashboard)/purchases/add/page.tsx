"use client";

import CreatePurchaseComponent from "../components/purchase-create";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddPurchasePage() {
  return (
    <PageWrapper title="Add Purchase" showBackButton>
      <CreatePurchaseComponent />
    </PageWrapper>
  );
}
