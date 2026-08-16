"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import ProductUpdateComponent from "../../components/product-update";

export default function EditProductPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.PRODUCT_UPDATE}>
      <PageWrapper title="Edit Product" showBackButton>
        <ProductUpdateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
