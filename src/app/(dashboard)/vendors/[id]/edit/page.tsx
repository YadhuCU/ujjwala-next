"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { VendorForm } from "../../components/vendor-form";
import type { VendorFormValues } from "../../components/vendor-form";
import { PageWrapper } from "@/components/page-wrapper";

interface VendorDetail {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
}

export default function EditVendorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: vendor, isLoading } = useQuery({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: () => api.getById<VendorDetail>("vendors", id),
    enabled: !!id,
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

  if (isLoading || !vendor) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading vendor...</p>
      </div>
    );
  }

  const formDefaults: VendorFormValues = {
    name: vendor.name || "",
    phone: vendor.phone || "",
    address: vendor.address || "",
    gstNumber: vendor.gstNumber || "",
  };

  return (
    <PageWrapper title="Edit Vendor" showBackButton>
      <VendorForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(v: VendorFormValues) => updateMutation.mutate(v)}
        isPending={updateMutation.isPending}
      />
    </PageWrapper>
  );
}
