import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  CreatePurchasePayloadSchema,
  PurchaseQuerySchema,
} from "@/module/purchase/purchase.payload.schema";
import * as PurchaseService from "@/module/purchase/purchase.service";
import { formatResponse } from "@/lib/response";
import { serializePurchases } from "@/module/purchase/purchase.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = PurchaseQuerySchema.parse(params);

    const result = await PurchaseService.getPurchases(query);
    return formatResponse({
      data: serializePurchases(result.data),
      meta: result.meta,
    });
  }, [PERMISSIONS.PURCHASE_READ]);
}

export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const json = await request.json();
      const data = CreatePurchasePayloadSchema.parse(json);

      const purchase = await PurchaseService.createPurchase(data, parseInt(id));

      return formatResponse({
        data: purchase,
        status: 201,
        message: "Created successfully",
      });
    },
    [PERMISSIONS.PURCHASE_CREATE],
  );
}
