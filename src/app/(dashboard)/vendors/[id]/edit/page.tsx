"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import VendorUpdateComponent from "../../components/vendor-update";

export default function EditVendorPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.VENDOR_UPDATE}>
      <PageWrapper title="Edit Vendor" showBackButton>
        <VendorUpdateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
