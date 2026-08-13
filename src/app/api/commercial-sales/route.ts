import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  CreateCommercialSaleSchema,
  CommercialSaleQuerySchema,
} from "@/module/commercial-sale/commercial-sale.payload.schema";
import * as CommercialSaleService from "@/module/commercial-sale/commercial-sale.service";
import { serializeCommercialSales } from "@/module/commercial-sale/commercial-sale.serializer";
import { formatResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = CommercialSaleQuerySchema.parse(params);

    const { data, meta } =
      await CommercialSaleService.getCommercialSales(query);

    return formatResponse({ data: serializeCommercialSales(data), meta });
  }, [PERMISSIONS.COMMERCIAL_SALE_READ]);
}

export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const data = CreateCommercialSaleSchema.parse(await request.json());
      const sale = await CommercialSaleService.createCommercialSale(
        data,
        Number(id),
      );

      return formatResponse({
        data: sale,
        status: 201,
        message: "Sale created successfully",
      });
    },
    [PERMISSIONS.COMMERCIAL_SALE_CREATE],
  );
}
