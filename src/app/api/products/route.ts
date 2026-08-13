import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateProductSchema,
  ProductQuerySchema,
} from "@/module/product/product.payload.schema";
import * as ProductService from "@/module/product/product.service";
import { serializeProduct } from "@/module/product/product.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = ProductQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const products = await ProductService.getProducts(query);

    return formatResponse({ data: products.map(serializeProduct) });
  }, [PERMISSIONS.PRODUCT_READ]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const data = CreateProductSchema.parse(await request.json());
    const product = await ProductService.createProduct(data);

    return formatResponse({
      data: serializeProduct(product),
      status: 201,
      message: "Product created successfully",
    });
  }, [PERMISSIONS.PRODUCT_CREATE]);
}
