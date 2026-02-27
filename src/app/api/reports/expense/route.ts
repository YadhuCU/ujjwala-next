import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(async ({ userId, role }) => {
    const url = request.nextUrl;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
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
      date: { gte: fromDate, lte: toDate },
    };

    if (role !== "Owner") {
      where.createdById = userId;
    } else if (staffId && staffId !== "all") {
      where.createdById = parseInt(staffId);
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`is_deleted = false`,
      Prisma.sql`date >= ${fromDate}`,
      Prisma.sql`date <= ${toDate}`,
    ];

    if (role !== "Owner") {
      conditions.push(Prisma.sql`created_by_id = ${userId}`);
    } else if (staffId && staffId !== "all") {
      conditions.push(Prisma.sql`created_by_id = ${parseInt(staffId)}`);
    }

    const whereClause = Prisma.join(conditions, " AND ");

    const summaryResult = await prisma.$queryRaw<
      {
        expense_count: bigint;
        total_amount: string | null;
      }[]
    >(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS expense_count,
        COALESCE(SUM(amount), 0)::text AS total_amount
      FROM expenses
      WHERE ${whereClause}
    `);

    const summary = summaryResult[0];

    return NextResponse.json({
      summary: {
        expenseCount: Number(summary?.expense_count ?? 0),
        totalAmount: parseFloat(summary?.total_amount || "0"),
      },
      data: expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}
