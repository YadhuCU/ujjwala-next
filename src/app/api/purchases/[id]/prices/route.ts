import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import * as PurchaseService from "@/module/purchase/purchase.service";
import { formatResponse } from "@/lib/response";
import { serializePurchase } from "@/module/purchase/purchase.serializer";
import { CorrectPurchasePricesSchema } from "@/module/purchase/purchase.payload.schema";

// Corrects unit costs in place — allowed after the batches have been sold
// from, unlike PUT. See PurchaseService.correctPurchasePrices.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;
      const data = CorrectPurchasePricesSchema.parse(await request.json());

      const purchase = await PurchaseService.correctPurchasePrices(
        Number(id),
        data,
        Number(userId),
      );
      return formatResponse({
        data: serializePurchase(purchase),
        message: "Purchase prices corrected.",
      });
    },
    [PERMISSIONS.PURCHASE_UPDATE],
  );
}
