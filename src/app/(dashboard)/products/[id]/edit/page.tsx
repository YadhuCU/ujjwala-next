"use client";

import { PageWrapper } from "@/components/page-wrapper";
import ProductUpdateComponent from "../../components/product-update";

export default function EditProductPage() {
  return (
    <PageWrapper title="Edit Product" showBackButton>
      <ProductUpdateComponent />
    </PageWrapper>
  );
}
