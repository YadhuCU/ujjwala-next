"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { VendorForm } from "../components/vendor-form";
import type { VendorFormValues } from "../components/vendor-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddVendorPage() {
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
    <PageWrapper title="Add Vendor" showBackButton>
      <VendorForm
        onSubmit={(v: VendorFormValues) => createMutation.mutate(v)}
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
