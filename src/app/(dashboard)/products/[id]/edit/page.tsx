"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ProductForm } from "../../components/product-form";
import type { ProductFormValues } from "../../components/product-form";
import { PageWrapper } from "@/components/page-wrapper";

interface ProductDetail {
  id: number;
  name: string | null;
  type: string | null;
  weight: string | null;
  price: string | null;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: product, isLoading } = useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => api.getById<ProductDetail>("products", id),
    enabled: !!id,
  });

  const updateMutation = useApiMutation({
    url: `/api/products/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.products.all],
    onSuccess: () => {
      toast.success("Product updated");
      router.push("/products");
    },
  });

  if (isLoading || !product) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading product...</p></div>;
  }

  const formDefaults: ProductFormValues = {
    name: product.name || "",
    type: product.type || "",
    weight: product.weight || "",
    price: product.price || "",
  };

  return (
    <PageWrapper title="Edit Product" showBackButton>
      <ProductForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(v: ProductFormValues) => updateMutation.mutate(v)}
        isPending={updateMutation.isPending}
      />
    </PageWrapper>
  );
}
