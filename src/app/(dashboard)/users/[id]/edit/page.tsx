"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { UserForm } from "../../components/user-form";
import type { UserFormValues } from "../../components/user-form";
import { PageWrapper } from "@/components/page-wrapper";
import type { UserRole } from "@/lib/constants";

interface UserDetail {
  id: number;
  username: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: user, isLoading } = useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => api.getById<UserDetail>("users", id),
    enabled: !!id,
  });

  const updateMutation = useApiMutation({
    url: `/api/users/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.users.all],
    onSuccess: () => {
      toast.success("User updated");
      router.push("/users");
    },
  });

  if (isLoading || !user) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading user...</p></div>;
  }

  const formDefaults: UserFormValues = {
    username: user.username || "",
    name: user.name || "",
    password: "",
    email: user.email || "",
    mobile: user.mobile || "",
    role: user.role || "Sales",
  };

  return (
    <PageWrapper title="Edit User" showBackButton>
      <UserForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(v: UserFormValues) => updateMutation.mutate(v)}
        isPending={updateMutation.isPending}
      />
    </PageWrapper>
  );
}
