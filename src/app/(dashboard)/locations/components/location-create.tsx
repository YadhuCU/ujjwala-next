"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { LocationForm } from "../components/location-form";
import { LocationFormValues } from "@/module/location/location.form.schema";

export function LocationCreateComponent() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/locations",
    invalidateKeys: [queryKeys.locations.all],
    onSuccess: () => {
      toast.success("Location added");
      router.push("/locations");
    },
  });

  return (
    <LocationForm
      onSubmit={(v: LocationFormValues) => createMutation.mutate(v)}
      isPending={createMutation.isPending}
    />
  );
}
