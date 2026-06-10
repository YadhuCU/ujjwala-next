"use client";

import { PageWrapper } from "@/components/page-wrapper";
import ProductCreateComponent from "../components/product-create";

export default function AddProductPage() {
  return (
    <PageWrapper title="Add Product" showBackButton>
      <ProductCreateComponent />
    </PageWrapper>
  );
}
