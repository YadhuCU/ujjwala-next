import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  CreateArbSaleSchema,
  ArbSaleQuerySchema,
} from "@/module/arb-sale/arb-sale.payload.schema";
import * as ArbSaleService from "@/module/arb-sale/arb-sale.service";
import { formatResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = ArbSaleQuerySchema.parse(params);

    const { data, meta } = await ArbSaleService.getArbSales(query);
    return formatResponse({ data, meta });
  }, [PERMISSIONS.ARB_SALE_READ]);
}

export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const data = CreateArbSaleSchema.parse(await request.json());
      const sale = await ArbSaleService.createArbSale(data, Number(id));

      return formatResponse({
        data: sale,
        status: 201,
        message: "Sale created successfully",
      });
    },
    [PERMISSIONS.ARB_SALE_CREATE],
  );
}
