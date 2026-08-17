import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  DeleteStockSchema,
  UpdateStockSchema,
} from "@/module/stock/stock.payload.schema";
import * as StockService from "@/module/stock/stock.service";
import { serializeStock } from "@/module/stock/stock.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const stock = await StockService.getStockById(Number(id));
    return formatResponse({ data: serializeStock(stock) });
  }, [PERMISSIONS.STOCK_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;
      const data = UpdateStockSchema.parse(await req.json());

      const stock = await StockService.updateStock(
        Number(id),
        data,
        Number(userId),
      );

      return formatResponse({
        data: serializeStock(stock),
        message: "Stock batch updated successfully",
      });
    },
    [PERMISSIONS.STOCK_UPDATE],
  );
}

export async function DELETE(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;

      // A reason is required — removing a batch moves the godown count
      const body = await req.json().catch(() => ({}));
      const data = DeleteStockSchema.parse({
        reason: body?.reason ?? "Manual stock batch removed",
      });

      await StockService.deleteStock(Number(id), data, Number(userId));

      return formatResponse({
        data: null,
        message: "Stock batch deleted successfully",
      });
    },
    [PERMISSIONS.STOCK_DELETE],
  );
}
