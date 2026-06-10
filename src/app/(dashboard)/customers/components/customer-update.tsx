"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { CustomerResponse } from "@/module/customer/customer.serializer";
import { CustomerForm } from "./customer-form";
import { CustomerFormValues } from "@/module/customer/customer.schema";

export function CustomerUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: customer } = useSuspenseQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => api.getById<CustomerResponse>("customers", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation({
    url: `/api/customers/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.customers.all],
    onSuccess: () => {
      toast.success("Customer updated");
      router.push("/customers");
    },
  });

  return (
    <CustomerForm
      defaultValues={customer satisfies CustomerFormValues}
      isEditMode
      onSubmit={(v: CustomerFormValues) => updateMutation.mutate(v)}
      isPending={updateMutation.isPending}
    />
  );
}
