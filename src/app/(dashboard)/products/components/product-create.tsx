"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { ProductForm } from "./product-form";

export default function ProductCreateComponent() {
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
    <ProductForm
      onSubmit={(v) => createMutation.mutate(v)}
      isPending={createMutation.isPending}
    />
  );
}
