"use client";

import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ProductForm } from "./product-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ProductResponse } from "@/module/product/product.serializer";

export default function ProductUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: product } = useSuspenseQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => api.getById<ProductResponse>("products", id),
    select: (res) => res.data,
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

  return (
    <ProductForm
      defaultValues={product}
      isEditMode
      onSubmit={(v) => updateMutation.mutate(v)}
      isPending={updateMutation.isPending}
    />
  );
}
