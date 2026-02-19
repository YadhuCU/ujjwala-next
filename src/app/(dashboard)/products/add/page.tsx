"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { ProductForm } from "../components/product-form";
import type { ProductFormValues } from "../components/product-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddProductPage() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/products",
    invalidateKeys: [queryKeys.products.all],
    onSuccess: () => {
      toast.success("Product added");
      router.push("/products");
    },
  });

  return (
    <PageWrapper title="Add Product" showBackButton>
      <ProductForm
        onSubmit={(v: ProductFormValues) => createMutation.mutate(v)}
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
