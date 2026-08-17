import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  CreateDomSaleSchema,
  DomSaleQuerySchema,
} from "@/module/dom-sale/dom-sale.payload.schema";
import * as DomSaleService from "@/module/dom-sale/dom-sale.service";
import { formatResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = DomSaleQuerySchema.parse(params);

    const { data, meta } = await DomSaleService.getDomSales(query);
    return formatResponse({ data, meta });
  }, [PERMISSIONS.DOMESTIC_SALE_READ]);
}

export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const data = CreateDomSaleSchema.parse(await request.json());
      const sale = await DomSaleService.createDomSale(data, Number(id));

      return formatResponse({
        data: sale,
        status: 201,
        message: "Sale created successfully",
      });
    },
    [PERMISSIONS.DOMESTIC_SALE_CREATE],
  );
}
