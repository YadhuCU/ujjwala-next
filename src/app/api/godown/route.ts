import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as GodownService from "@/module/godown/godown.service";

export async function GET() {
  return withAuth(async () => {
    const status = await GodownService.getGodownStatus();
    return formatResponse({ data: status });
  }, [PERMISSIONS.STOCK_READ]);
}
