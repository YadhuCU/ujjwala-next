import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const paymentSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (authResult) => {
    const { id } = await params;
    const body = await req.json();
  const parsed = paymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, notes } = parsed.data;

  const arbSale = await prisma.arbSale.findUnique({
    where: { id: parseInt(id), isDeleted: false },
  });

  if (!arbSale) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newPaid = Number(arbSale.paidAmount) + amount;
  if (newPaid > Number(arbSale.totalAmount)) {
    return NextResponse.json({ error: "Payment exceeds sale total" }, { status: 400 });
  }

  const [updatedSale, collection] = await prisma.$transaction([
    prisma.arbSale.update({
      where: { id: parseInt(id) },
      data: { paidAmount: newPaid },
    }),
    prisma.collection.create({
      data: {
        customerId: arbSale.customerId,
        arbSaleId: parseInt(id),
        amount,
        createdById: authResult.userId,
      },
    }),
  ]);

  return NextResponse.json({ updatedSale, collection });
  });
}
