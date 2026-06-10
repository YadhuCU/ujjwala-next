import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ProductType } from "@/generated/enums";
import { CreateProductSchema } from "@/module/product/product.schema";
import { serializeProduct } from "@/module/product/product.serializer";
import { formatResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const type = req.nextUrl.searchParams.get("type") as ProductType | null;
    const products = await prisma.product.findMany({
      where: { isDeleted: false, ...(type && { type }) },
      orderBy: { createdAt: "desc" },
    });

    return formatResponse({
      data: products.map(serializeProduct),
      message: "",
    });
  }, [PERMISSIONS.PRODUCT_READ]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const body = await request.json();
    const data = CreateProductSchema.parse(body);

    const product = await prisma.product.create({ data });

    return formatResponse({
      data: serializeProduct(product),
      message: "Product created successfully",
      status: 201,
    });
  }, [PERMISSIONS.PRODUCT_CREATE]);
}
