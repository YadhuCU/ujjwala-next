import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as DomSaleService from "@/module/dom-sale/dom-sale.service";
import { UpdateDomSaleSchema } from "@/module/dom-sale/dom-sale.payload.schema";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async ({ userId, permissions, isOwner }) => {
    const { id } = await params;
    const sale = await DomSaleService.getDomSaleById(Number(id), {
      userId,
      permissions,
      isOwner,
    });
    return formatResponse({ data: sale });
  }, [PERMISSIONS.DOMESTIC_SALE_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ userId, permissions, isOwner }) => {
      const { id: domSaleId } = await params;
      const data = UpdateDomSaleSchema.parse(await req.json());
      const sale = await DomSaleService.updateDomSale(
        parseInt(domSaleId),
        data,
        { userId, permissions, isOwner },
      );
      return formatResponse({
        data: sale,
        message: "Sale updated successfully",
      });
    },
    [PERMISSIONS.DOMESTIC_SALE_UPDATE],
  );
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ userId, permissions, isOwner }) => {
      const { id: domSaleId } = await params;
      await DomSaleService.deleteDomSale(parseInt(domSaleId), {
        userId,
        permissions,
        isOwner,
      });
      return formatResponse({
        data: null,
        message: "Sale deleted successfully",
      });
    },
    [PERMISSIONS.DOMESTIC_SALE_DELETE],
  );
}
