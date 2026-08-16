"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { RoleForm } from "./role-form";
import type { RoleFormValues } from "@/module/role/role.form.schema";
import type { RoleResponse } from "@/module/role/role.serializer";

export function RoleUpdateComponent({ id }: { id: string }) {
  const router = useRouter();
  const { update } = useSession();

  const { data: role } = useSuspenseQuery({
    queryKey: queryKeys.roles.detail(id),
    queryFn: () => api.getById<RoleResponse>("roles", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation<RoleFormValues>({
    url: `/api/roles/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.roles.all],
    onSuccess: async () => {
      // Everyone holding this role picks the change up on their next poll;
      // the admin who made it should not have to wait for that.
      await update({ rbac: "changed" });
      toast.success("Role updated");
      router.push("/roles");
    },
  });

  return (
    <RoleForm
      isEditMode
      isSystem={role.isSystem}
      defaultValues={{
        name: role.name,
        description: role.description ?? "",
        permissionCodes: role.permissionCodes,
      }}
      onSubmit={(values) => updateMutation.mutate(values)}
      isPending={updateMutation.isPending}
    />
  );
}
