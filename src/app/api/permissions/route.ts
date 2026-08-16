import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as RoleService from "@/module/role/role.service";

/**
 * The permission catalogue, grouped by module for the role editor's matrix.
 * Read-only: codes are defined in source because a code no route checks would
 * grant nothing. Roles and their grants are what the UI manages.
 */
export async function GET() {
  return withAuth(async () => {
    return formatResponse({ data: RoleService.getPermissionCatalogue() });
  }, [PERMISSIONS.ROLE_READ]);
}
