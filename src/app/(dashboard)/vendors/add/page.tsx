"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import VendorCreateComponent from "../components/vendor-create";

export default function AddVendorPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.VENDOR_CREATE}>
      <PageWrapper title="Add Vendor" showBackButton>
        <VendorCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
