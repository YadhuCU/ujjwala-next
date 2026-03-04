import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ProductType } from "@prisma/client";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const type = req.nextUrl.searchParams.get("type") as ProductType | null;
    const products = await prisma.product.findMany({
      where: { isDeleted: false, ...(type && { type }) },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  });
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();
      const product = await prisma.product.create({
        data: {
          name: data.name,
          type: data.type || null,
          weight: data.weight,
          salePrice: data.salePrice != null ? Number(data.salePrice) : null,
        },
      });
      return NextResponse.json(product, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create product";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "Owner");
}
