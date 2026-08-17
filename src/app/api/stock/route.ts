import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateStockSchema,
  StockQuerySchema,
} from "@/module/stock/stock.payload.schema";
import * as StockService from "@/module/stock/stock.service";
import {
  serializeStock,
  serializeStocks,
} from "@/module/stock/stock.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = StockQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const stocks = await StockService.getStocks(query);

    return formatResponse({ data: serializeStocks(stocks) });
  }, [PERMISSIONS.STOCK_READ]);
}

// Manual batch — opening stock or a batch with no purchase behind it. The
// service posts the matching ADJUSTMENT so the cylinder ledger stays true.
export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const data = CreateStockSchema.parse(await request.json());
      const stock = await StockService.createStock(data, Number(id));

      return formatResponse({
        data: serializeStock(stock),
        status: 201,
        message: "Stock batch created successfully",
      });
    },
    [PERMISSIONS.STOCK_CREATE],
  );
}
