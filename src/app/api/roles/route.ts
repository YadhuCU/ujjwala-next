import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatResponse } from "@/lib/response";

export async function GET() {
  return withAuth(async () => {
    const roles = await prisma.role.findMany();
    return formatResponse({ data: roles, message: "" });
  }, [PERMISSIONS.ROLE_READ]);
}
