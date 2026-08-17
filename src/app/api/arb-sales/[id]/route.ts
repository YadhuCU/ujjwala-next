import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as ArbSaleService from "@/module/arb-sale/arb-sale.service";
import { UpdateArbSaleSchema } from "@/module/arb-sale/arb-sale.payload.schema";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const sale = await ArbSaleService.getArbSaleById(Number(id));
    return formatResponse({ data: sale });
  }, [PERMISSIONS.ARB_SALE_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id: domSaleId } = await params;
      const data = UpdateArbSaleSchema.parse(await req.json());
      const sale = await ArbSaleService.updateArbSale(
        parseInt(domSaleId),
        data,
        parseInt(userId),
      );
      return formatResponse({
        data: sale,
        message: "Sale updated successfully",
      });
    },
    [PERMISSIONS.ARB_SALE_UPDATE],
  );
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id: domSaleId } = await params;
      await ArbSaleService.deleteArbSale(parseInt(domSaleId), parseInt(userId));
      return formatResponse({
        data: null,
        message: "Sale deleted successfully",
      });
    },
    [PERMISSIONS.ARB_SALE_DELETE],
  );
}
