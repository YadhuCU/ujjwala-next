"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { UserTypeForm } from "../../components/user-type-form";
import type { UserTypeFormValues } from "../../components/user-type-form";
import { PageWrapper } from "@/components/page-wrapper";

interface UserTypeDetail {
  id: number;
  name: string | null;
  role: string | null;
}

export default function EditUserTypePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: userType, isLoading } = useQuery({
    queryKey: queryKeys.userTypes.detail(id),
    queryFn: () => api.getById<UserTypeDetail>("user-types", id),
    enabled: !!id,
  });

  const updateMutation = useApiMutation({
    url: `/api/user-types/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.userTypes.all],
    onSuccess: () => {
      toast.success("User type updated");
      router.push("/user-types");
    },
  });

  if (isLoading || !userType) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading user type...</p></div>;
  }

  const formDefaults: UserTypeFormValues = {
    name: userType.name || "",
    role: userType.role || "",
  };

  return (
    <PageWrapper title="Edit User Type" showBackButton>
      <UserTypeForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(v: UserTypeFormValues) => updateMutation.mutate(v)}
        isPending={updateMutation.isPending}
      />
    </PageWrapper>
  );
}
