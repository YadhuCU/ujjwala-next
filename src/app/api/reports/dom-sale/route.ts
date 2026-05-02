import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";

/**
 * GET /api/reports/dom-sale
 * Paginated + summarised Domestic Sale (DomSale model) report.
 */
export async function GET(request: NextRequest) {
  return withAuth(async ({ userId, role }) => {
    const url = request.nextUrl;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const customerId = url.searchParams.get("customerId");
    const staffId = url.searchParams.get("staffId");
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
      createdAt: { gte: fromDate, lte: toDate },
    };

    if (role !== "Owner") {
      where.createdById = userId;
    } else if (staffId && staffId !== "all") {
      where.createdById = parseInt(staffId);
    }

    if (customerId && customerId !== "all") {
      where.customerId = parseInt(customerId);
    }

    const [sales, total] = await Promise.all([
      prisma.domSale.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { name: true } },
              stock: { select: { batchNo: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.domSale.count({ where }),
    ]);

    // Raw SQL aggregation on dom_sales table
    const conditions: Prisma.Sql[] = [
      Prisma.sql`is_deleted = false`,
      Prisma.sql`created_at >= ${fromDate}`,
      Prisma.sql`created_at <= ${toDate}`,
    ];

    if (role !== "Owner") {
      conditions.push(Prisma.sql`created_by_id = ${userId}`);
    } else if (staffId && staffId !== "all") {
      conditions.push(Prisma.sql`created_by_id = ${parseInt(staffId)}`);
    }

    if (customerId && customerId !== "all") {
      conditions.push(Prisma.sql`customer_id = ${parseInt(customerId)}`);
    }

    const whereClause = Prisma.join(conditions, " AND ");

    const summaryResult = await prisma.$queryRaw<
      {
        invoice_count: bigint;
        total_subtotal: string | null;
        total_discount_amount: string | null;
        total_net_total: string | null;
      }[]
    >(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS invoice_count,
        COALESCE(SUM(total_amount), 0)::text AS total_subtotal,
        COALESCE(SUM(discount), 0)::text AS total_discount_amount,
        COALESCE(SUM(COALESCE(total_amount, 0) - COALESCE(discount, 0)), 0)::text AS total_net_total
      FROM dom_sales
      WHERE ${whereClause}
    `);

    const summary = summaryResult[0];

    return NextResponse.json({
      summary: {
        invoiceCount: Number(summary?.invoice_count ?? 0),
        totalSubtotal: parseFloat(summary?.total_subtotal || "0"),
        totalDiscount: parseFloat(summary?.total_discount_amount || "0"),
        totalNetTotal: parseFloat(summary?.total_net_total || "0"),
      },
      data: sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}
