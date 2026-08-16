import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateRoleSchema,
  RoleQuerySchema,
} from "@/module/role/role.payload.schema";
import * as RoleService from "@/module/role/role.service";
import { serializeRole, serializeRoles } from "@/module/role/role.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const params = Object.fromEntries(req.nextUrl.searchParams);

    // The user form only needs id + name, and asks for it with ?options=true
    // rather than paging through the full list.
    if (params.options === "true") {
      return formatResponse({ data: await RoleService.getRoleOptions() });
    }

    const query = RoleQuerySchema.parse(params);
    const result = await RoleService.getRoles(query);

    return formatResponse({
      data: serializeRoles(result.data),
      meta: result.meta,
    });
  }, [PERMISSIONS.ROLE_READ]);
}

export async function POST(request: Request) {
  return withAuth(
    async ({ userId, permissions, isOwner }) => {
      const data = CreateRoleSchema.parse(await request.json());
      const role = await RoleService.createRole(data, {
        userId,
        permissions,
        isOwner,
      });

      return formatResponse({
        data: serializeRole(role),
        status: 201,
        message: "Role created successfully",
      });
    },
    [PERMISSIONS.ROLE_CREATE],
  );
}
