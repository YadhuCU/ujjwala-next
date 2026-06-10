import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { serializeProduct } from "@/module/product/product.serializer";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { formatResponse } from "@/lib/response";
import { UpdateProductSchema } from "@/module/product/product.schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;

    const productId = Number(id);

    if (Number.isNaN(productId)) {
      throw new BadRequestError("Invalid product id");
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return formatResponse({ data: serializeProduct(product), message: "" });
  }, [PERMISSIONS.PRODUCT_READ]);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const json = await request.json();
    const data = UpdateProductSchema.parse(json);

    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data,
    });
    return formatResponse({ data: serializeProduct(product), message: "" });
  }, [PERMISSIONS.PRODUCT_UPDATE]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.product.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true },
    });
    return formatResponse({
      data: null,
      message: "Product deleted successfully",
    });
  }, [PERMISSIONS.PRODUCT_DELETE]);
}
