import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";

export function usePermissions() {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;

  const isAdmin = role === "Owner";
  const isOffice = role === "Office";
  const isSales = role === "Sales";

  return {
    role,
    isAdmin,
    isOffice,
    isSales,
  };
}
