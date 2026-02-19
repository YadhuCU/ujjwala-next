"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { LocationForm } from "../components/location-form";
import type { LocationFormValues } from "../components/location-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddLocationPage() {
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
    <PageWrapper title="Add Location" showBackButton>
      <LocationForm
        onSubmit={(v: LocationFormValues) => createMutation.mutate(v)}
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
