import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(async ({ role }) => {
    // Only admins usually view purchases, or depends on rules, but we'll allow based on UI access.
    // If not admin and user doesn't have access, UI won't show the menu anyway.
    
    const url = request.nextUrl;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const vendorId = url.searchParams.get("vendorId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to date params are required" },
        { status: 400 }
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: "from date must not be greater than to date" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isDeleted: false,
      purchaseDate: { gte: fromDate, lte: toDate },
    };

    if (vendorId && vendorId !== "all") {
      where.vendorId = parseInt(vendorId);
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { purchaseDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchase.count({ where }),
    ]);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`is_deleted = false`,
      Prisma.sql`purchase_date >= ${fromDate}`,
      Prisma.sql`purchase_date <= ${toDate}`,
    ];

    if (vendorId && vendorId !== "all") {
      conditions.push(Prisma.sql`vendor_id = ${parseInt(vendorId)}`);
    }

    const whereClause = Prisma.join(conditions, " AND ");

    const summaryResult = await prisma.$queryRaw<
      {
        invoice_count: bigint;
        total_amount: string | null;
      }[]
    >(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS invoice_count,
        COALESCE(SUM(total_amount), 0)::text AS total_amount
      FROM purchases
      WHERE ${whereClause}
    `);

    const summary = summaryResult[0];

    return NextResponse.json({
      summary: {
        invoiceCount: Number(summary?.invoice_count ?? 0),
        totalAmount: parseFloat(summary?.total_amount || "0"),
      },
      data: purchases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}
