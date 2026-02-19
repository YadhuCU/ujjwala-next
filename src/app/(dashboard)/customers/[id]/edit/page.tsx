"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { CustomerForm } from "../../components/customer-form";
import type { CustomerFormValues } from "@/lib/schemas";
import { PageWrapper } from "@/components/page-wrapper";

interface CustomerDetail {
  id: number;
  name: string | null;
  phone: string | null;
  address: string | null;
  locationId: number | null;
  discount: string | null;
  concernedPerson: string | null;
  concernedPersonMobile: string | null;
  gstNumber: string | null;
  initialCylinderBalance: number | null;
  initialPendingAmount: string | null;
}

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: customer, isLoading } = useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => api.getById<CustomerDetail>("customers", id),
    enabled: !!id,
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

  if (isLoading || !customer) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading customer...</p></div>;
  }

  const formDefaults: CustomerFormValues = {
    name: customer.name || "",
    phone: customer.phone || "",
    address: customer.address || "",
    locationId: customer.locationId ? String(customer.locationId) : "",
    discount: customer.discount || "",
    concernedPerson: customer.concernedPerson || "",
    concernedPersonMobile: customer.concernedPersonMobile || "",
    gstNumber: customer.gstNumber || "",
    initialCylinderBalance: customer.initialCylinderBalance ?? 0,
    initialPendingAmount: customer.initialPendingAmount
      ? parseFloat(customer.initialPendingAmount)
      : 0,
  };

  return (
    <PageWrapper title="Edit Customer" showBackButton>
      <CustomerForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(v: CustomerFormValues) => updateMutation.mutate(v)}
        isPending={updateMutation.isPending}
      />
    </PageWrapper>
  );
}
