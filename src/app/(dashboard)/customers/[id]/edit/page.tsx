"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { CustomerUpdateComponent } from "../../components/customer-update";

export default function EditCustomerPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.CUSTOMER_UPDATE}>
      <PageWrapper title="Edit Customer" showBackButton>
        <CustomerUpdateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
