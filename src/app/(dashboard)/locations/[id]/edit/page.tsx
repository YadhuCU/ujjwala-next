"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { LocationForm } from "../../components/location-form";
import type { LocationFormValues } from "../../components/location-form";
import { PageWrapper } from "@/components/page-wrapper";

interface LocationDetail {
  id: number;
  name: string | null;
  district: string | null;
  pincode: string | null;
  locality: string | null;
}

export default function EditLocationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: location, isLoading } = useQuery({
    queryKey: queryKeys.locations.detail(id),
    queryFn: () => api.getById<LocationDetail>("locations", id),
    enabled: !!id,
  });

  const updateMutation = useApiMutation({
    url: `/api/locations/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.locations.all],
    onSuccess: () => {
      toast.success("Location updated");
      router.push("/locations");
    },
  });

  if (isLoading || !location) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading location...</p></div>;
  }

  const formDefaults: LocationFormValues = {
    name: location.name || "",
    district: location.district || "",
    pincode: location.pincode || "",
    locality: location.locality || "",
  };

  return (
    <PageWrapper title="Edit Location" showBackButton>
      <LocationForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(v: LocationFormValues) => updateMutation.mutate(v)}
        isPending={updateMutation.isPending}
      />
    </PageWrapper>
  );
}
