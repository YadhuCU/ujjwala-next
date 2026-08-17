import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { UpdateProductSchema } from "@/module/product/product.payload.schema";
import * as ProductService from "@/module/product/product.service";
import { serializeProduct } from "@/module/product/product.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const product = await ProductService.getProductById(Number(id));
    return formatResponse({ data: serializeProduct(product) });
  }, [PERMISSIONS.PRODUCT_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const data = UpdateProductSchema.parse(await req.json());

    const product = await ProductService.updateProduct(Number(id), data);

    return formatResponse({
      data: serializeProduct(product),
      message: "Product updated successfully",
    });
  }, [PERMISSIONS.PRODUCT_UPDATE]);
}

export async function DELETE(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;

    await ProductService.deleteProduct(Number(id));

    return formatResponse({
      data: null,
      message: "Product deleted successfully",
    });
  }, [PERMISSIONS.PRODUCT_DELETE]);
}
