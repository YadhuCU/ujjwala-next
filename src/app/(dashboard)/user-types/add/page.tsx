"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { UserTypeForm } from "../components/user-type-form";
import type { UserTypeFormValues } from "../components/user-type-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddUserTypePage() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/user-types",
    invalidateKeys: [queryKeys.userTypes.all],
    onSuccess: () => {
      toast.success("User type added");
      router.push("/user-types");
    },
  });

  return (
    <PageWrapper title="Add User Type" showBackButton>
      <UserTypeForm
        onSubmit={(v: UserTypeFormValues) => createMutation.mutate(v)}
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
