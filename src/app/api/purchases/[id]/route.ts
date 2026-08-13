import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import * as PurchaseService from "@/module/purchase/purchase.service";
import { formatResponse } from "@/lib/response";
import { serializePurchase } from "@/module/purchase/purchase.serializer";
import { UpdatePurchasePayloadSchema } from "@/module/purchase/purchase.payload.schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const purchase = await PurchaseService.getPurchaseById(Number(id));
    return formatResponse({ data: serializePurchase(purchase) });
  }, [PERMISSIONS.PURCHASE_READ]);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;
      const payload = await request.json();
      const data = UpdatePurchasePayloadSchema.parse(payload);

      const purchase = await PurchaseService.updatePurchase(
        Number(id),
        data,
        Number(userId),
      );
      return formatResponse({
        data: purchase,
        message: "Purchase updated successfully.",
      });
    },
    [PERMISSIONS.PURCHASE_UPDATE],
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;

      await PurchaseService.deletePurchase(Number(id), Number(userId));

      return formatResponse({ message: "Purchase deleted", data: null });
    },
    [PERMISSIONS.PURCHASE_DELETE],
  );
}
