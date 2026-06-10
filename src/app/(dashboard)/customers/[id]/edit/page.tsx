"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { CustomerUpdateComponent } from "../../components/customer-update";

export default function EditCustomerPage() {
  return (
    <PageWrapper title="Edit Customer" showBackButton>
      <CustomerUpdateComponent />
    </PageWrapper>
  );
}
