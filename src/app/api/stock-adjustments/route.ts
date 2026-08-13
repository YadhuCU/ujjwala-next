import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateStockAdjustmentSchema,
  StockAdjustmentQuerySchema,
} from "@/module/stock-adjustment/stock-adjustment.payload.schema";
import * as StockAdjustmentService from "@/module/stock-adjustment/stock-adjustment.service";
import { serializeStockAdjustments } from "@/module/stock-adjustment/stock-adjustment.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = StockAdjustmentQuerySchema.parse(params);

    const result =
      await StockAdjustmentService.getStockAdjustments(query);

    return formatResponse({
      data: serializeStockAdjustments(result.data),
      meta: result.meta,
    });
  }, [PERMISSIONS.STOCK_READ]);
}

// Adjustments are create-only — there is no PUT or DELETE anywhere for them.
export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const data = CreateStockAdjustmentSchema.parse(await request.json());

      const adjustment = await StockAdjustmentService.createStockAdjustment(
        data,
        Number(id),
      );

      return formatResponse({
        data: adjustment,
        status: 201,
        message: "Stock adjustment recorded",
      });
    },
    [PERMISSIONS.STOCK_UPDATE],
  );
}
