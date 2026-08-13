import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as UserService from "@/module/user/user.service";

export async function GET() {
  return withAuth(async () => {
    const roles = await UserService.getRoles();
    return formatResponse({ data: roles });
  }, [PERMISSIONS.ROLE_READ]);
}
