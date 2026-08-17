import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as StockAdjustmentService from "@/module/stock-adjustment/stock-adjustment.service";
import { serializeStockAdjustment } from "@/module/stock-adjustment/stock-adjustment.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

// Read only — an adjustment is permanent. To correct one, post another.
export async function GET(_req: NextRequest, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;

    const adjustment = await StockAdjustmentService.getStockAdjustmentById(
      Number(id),
    );

    return formatResponse({ data: serializeStockAdjustment(adjustment) });
  }, [PERMISSIONS.STOCK_READ]);
}
