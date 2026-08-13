import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as CommercialSaleService from "@/module/commercial-sale/commercial-sale.service";
import { UpdateCommercialSaleSchema } from "@/module/commercial-sale/commercial-sale.payload.schema";
import { serializeCommercialSale } from "@/module/commercial-sale/commercial-sale.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const sale = await CommercialSaleService.getCommercialSaleById(Number(id));
    return formatResponse({ data: serializeCommercialSale(sale) });
  }, [PERMISSIONS.COMMERCIAL_SALE_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;
      const data = UpdateCommercialSaleSchema.parse(await req.json());

      const sale = await CommercialSaleService.updateCommercialSale(
        Number(id),
        data,
        Number(userId),
      );

      return formatResponse({
        data: serializeCommercialSale(sale),
        message: "Sale updated successfully",
      });
    },
    [PERMISSIONS.COMMERCIAL_SALE_UPDATE],
  );
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;

      await CommercialSaleService.deleteCommercialSale(
        Number(id),
        Number(userId),
      );

      return formatResponse({
        data: null,
        message: "Sale deleted successfully",
      });
    },
    [PERMISSIONS.COMMERCIAL_SALE_DELETE],
  );
}
