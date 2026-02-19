"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { UserForm } from "../components/user-form";
import type { UserFormValues } from "../components/user-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddUserPage() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/users",
    invalidateKeys: [queryKeys.users.all],
    onSuccess: () => {
      toast.success("User added");
      router.push("/users");
    },
  });

  return (
    <PageWrapper title="Add User" showBackButton>
      <UserForm
        onSubmit={(v: UserFormValues) => createMutation.mutate(v)}
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
