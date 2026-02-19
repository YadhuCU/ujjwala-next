"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { CustomerForm } from "../components/customer-form";
import type { CustomerFormValues } from "@/lib/schemas";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddCustomerPage() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/customers",
    invalidateKeys: [queryKeys.customers.all],
    onSuccess: () => {
      toast.success("Customer added");
      router.push("/customers");
    },
  });

  return (
    <PageWrapper title="Add Customer" showBackButton>
      <CustomerForm
        onSubmit={(v: CustomerFormValues) => createMutation.mutate(v)}
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
