import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const products = await prisma.product.findMany({
      where: { isDeleted: false },
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
        data: { name: data.name, type: data.type, weight: data.weight, price: data.price },
      });
      return NextResponse.json(product, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create product";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "admin");
}
