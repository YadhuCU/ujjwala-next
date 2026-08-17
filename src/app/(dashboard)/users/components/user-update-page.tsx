"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { UserResponse } from "@/module/user/user.serializer";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";
import { UserForm, UserFormValues } from "./user-form";

export const UserUpdatePage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: user } = useSuspenseQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => api.getById<UserResponse>("users", id),
    select: (res) => res.data,
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

  const formDefaults: UserFormValues = {
    username: user.username || "",
    name: user.name || "",
    password: "",
    email: user.email || "",
    mobile: user.mobile || "",
    userRoles: user.userRoles.map((x) => x.id),
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
};
