"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { CustomerCreateComponent } from "../components/customer-create";

export default function AddCustomerPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.CUSTOMER_CREATE}>
      <PageWrapper title="Add Customer" showBackButton>
        <CustomerCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
