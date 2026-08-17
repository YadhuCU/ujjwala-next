import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as CommercialSaleService from "@/module/commercial-sale/commercial-sale.service";
import { CylinderReturnSchema } from "@/module/commercial-sale/commercial-sale.payload.schema";
import { serializeCommercialSale } from "@/module/commercial-sale/commercial-sale.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

// A cylinder return is its own business event — never an edit of the invoice.
export async function PATCH(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;
      const data = CylinderReturnSchema.parse(await req.json());

      const sale = await CommercialSaleService.returnCylinders(
        Number(id),
        data,
        Number(userId),
      );

      return formatResponse({
        data: serializeCommercialSale(sale),
        message: "Cylinder return recorded",
      });
    },
    [PERMISSIONS.COMMERCIAL_SALE_UPDATE],
  );
}
