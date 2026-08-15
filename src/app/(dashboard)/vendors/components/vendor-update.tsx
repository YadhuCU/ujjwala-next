"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { VendorForm } from "./vendor-form";
import { VendorResponse } from "@/module/vendor/vendor.serializer";

export default function VendorUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: vendor } = useSuspenseQuery({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: () => api.getById<VendorResponse>("vendors", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation({
    url: `/api/vendors/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.vendors.all],
    onSuccess: () => {
      toast.success("Vendor updated");
      router.push("/vendors");
    },
  });

  const formDefaults = {
    name: vendor.name || "",
    phone: vendor.phone || "",
    address: vendor.address || "",
    gstNumber: vendor.gstNumber || "",
  };

  return (
    <VendorForm
      defaultValues={formDefaults}
      isEditMode
      onSubmit={(v) => updateMutation.mutate(v)}
      isPending={updateMutation.isPending}
    />
  );
}
