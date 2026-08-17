"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import ProductCreateComponent from "../components/product-create";

export default function AddProductPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.PRODUCT_CREATE}>
      <PageWrapper title="Add Product" showBackButton>
        <ProductCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
