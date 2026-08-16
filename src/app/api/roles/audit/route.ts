import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as RbacAuditService from "@/module/role/rbac-audit.service";
import { serializeRbacAuditEntries } from "@/module/role/rbac-audit.serializer";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  roleId: z.coerce.number().int().optional(),
  targetUserId: z.coerce.number().int().optional(),
});

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = QuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const result = await RbacAuditService.getRbacAuditLog(query);

    return formatResponse({
      data: serializeRbacAuditEntries(result.data),
      meta: result.meta,
    });
  }, [PERMISSIONS.ROLE_READ]);
}
