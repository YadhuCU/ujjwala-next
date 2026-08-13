"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { LocationForm } from "./location-form";
import { LocationFormValues } from "@/module/location/location.form.schema";

interface LocationDetail {
  id: number;
  name: string | null;
  district: string | null;
  pincode: string | null;
  locality: string | null;
}

export default function LocationUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: location } = useSuspenseQuery({
    queryKey: queryKeys.locations.detail(id),
    queryFn: () => api.getById<LocationDetail>("locations", id),
    select: (res) => res.data,
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

  const formDefaults: LocationFormValues = {
    name: location.name || "",
    district: location.district || "",
    pincode: location.pincode || "",
    locality: location.locality || "",
  };

  return (
    <LocationForm
      defaultValues={formDefaults}
      isEditMode
      onSubmit={(v: LocationFormValues) => updateMutation.mutate(v)}
      isPending={updateMutation.isPending}
    />
  );
}
