"use client";

import { PageWrapper } from "@/components/page-wrapper";
import VendorCreateComponent from "../components/vendor-create";

export default function AddVendorPage() {
  return (
    <PageWrapper title="Add Vendor" showBackButton>
      <VendorCreateComponent />
    </PageWrapper>
  );
}
