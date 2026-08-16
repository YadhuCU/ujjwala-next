"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { RoleForm } from "./role-form";
import type { RoleFormValues } from "@/module/role/role.form.schema";

export function RoleCreateComponent() {
  const router = useRouter();
  const { update } = useSession();

  const createMutation = useApiMutation<RoleFormValues>({
    url: "/api/roles",
    invalidateKeys: [queryKeys.roles.all],
    onSuccess: async () => {
      // Refresh this admin's own session immediately. `update()` must be given
      // an argument — with none it issues a GET and the server never sees an
      // update trigger.
      await update({ rbac: "changed" });
      toast.success("Role created");
      router.push("/roles");
    },
  });

  return (
    <RoleForm
      onSubmit={(values) => createMutation.mutate(values)}
      isPending={createMutation.isPending}
    />
  );
}
