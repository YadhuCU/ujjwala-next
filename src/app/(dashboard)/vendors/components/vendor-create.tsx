"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { VendorForm } from "../components/vendor-form";
import type { VendorFormValues } from "../components/vendor-form";

export default function VendorCreateComponent() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/vendors",
    invalidateKeys: [queryKeys.vendors.all],
    onSuccess: () => {
      toast.success("Vendor added");
      router.push("/vendors");
    },
  });

  return (
    <VendorForm
      onSubmit={(v: VendorFormValues) => createMutation.mutate(v)}
      isPending={createMutation.isPending}
    />
  );
}
