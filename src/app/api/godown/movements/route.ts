import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { GodownMovementQuerySchema } from "@/module/godown/godown.payload.schema";
import * as GodownService from "@/module/godown/godown.service";
import { serializeMovements } from "@/module/godown/godown.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = GodownMovementQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const { data, meta } = await GodownService.getGodownMovements(query);

    return formatResponse({ data: serializeMovements(data), meta });
  }, [PERMISSIONS.STOCK_READ]);
}
