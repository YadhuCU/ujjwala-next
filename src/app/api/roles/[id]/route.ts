import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { UpdateRoleSchema } from "@/module/role/role.payload.schema";
import * as RoleService from "@/module/role/role.service";
import { serializeRole } from "@/module/role/role.serializer";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const role = await RoleService.getRoleById(Number(id));

    return formatResponse({ data: serializeRole(role) });
  }, [PERMISSIONS.ROLE_READ]);
}

export async function PUT(request: Request, { params }: Params) {
  return withAuth(
    async ({ userId, permissions, isOwner, name }) => {
      const { id } = await params;
      const data = UpdateRoleSchema.parse(await request.json());

      const role = await RoleService.updateRole(Number(id), data, {
        userId,
        permissions,
        isOwner,
        name,
      });

      return formatResponse({
        data: serializeRole(role),
        message: "Role updated successfully",
      });
    },
    [PERMISSIONS.ROLE_UPDATE],
  );
}

export async function DELETE(_request: Request, { params }: Params) {
  return withAuth(
    async ({ userId, permissions, isOwner, name }) => {
      const { id } = await params;
      await RoleService.deleteRole(Number(id), {
        userId,
        permissions,
        isOwner,
        name,
      });

      return formatResponse({ message: "Role deleted successfully", data: null });
    },
    [PERMISSIONS.ROLE_DELETE],
  );
}
