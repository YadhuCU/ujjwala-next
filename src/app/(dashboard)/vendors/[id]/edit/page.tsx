"use client";

import { PageWrapper } from "@/components/page-wrapper";
import VendorUpdateComponent from "../../components/vendor-update";

export default function EditVendorPage() {
  return (
    <PageWrapper title="Edit Vendor" showBackButton>
      <VendorUpdateComponent />
    </PageWrapper>
  );
}
