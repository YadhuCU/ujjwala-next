import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(async ({ userId, role }) => {
    const url = request.nextUrl;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const staffId = url.searchParams.get("staffId");
    const format = url.searchParams.get("format") || "excel";

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to date params are required" },
        { status: 400 }
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

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

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    });

    let totalAmount = 0;
    for (const e of expenses) {
      totalAmount += Number(e.amount ?? 0);
    }

    if (format === "pdf") {
      const lines: string[] = [];
      lines.push("EXPENSE REPORT");
      lines.push(`Date Range: ${from} to ${to}`);
      lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
      lines.push("");
      lines.push("SUMMARY");
      lines.push(`Total Expenses: ${expenses.length}`);
      lines.push(`Total Amount: ${totalAmount.toFixed(2)}`);
      lines.push("");
      lines.push(["Date", "Expense", "Amount", "Staff"].join("\t"));

      for (const e of expenses) {
        lines.push(
          [
            e.date ? new Date(e.date).toLocaleDateString("en-IN") : "",
            e.expense || "",
            e.amount?.toString() || "0",
            e.createdBy?.name || "",
          ].join("\t")
        );
      }

      const content = lines.join("\n");
      const dateStr = new Date().toISOString().split("T")[0];

      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="expense_report_${dateStr}.txt"`,
        },
      });
    }

    const headers = ["Date", "Expense", "Amount", "Staff"];

    const rows = expenses.map((e) =>
      [
        e.date ? new Date(e.date).toLocaleDateString("en-IN") : "",
        e.expense || "",
        e.amount?.toString() || "0",
        e.createdBy?.name || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    const summaryRows = [
      `"EXPENSE REPORT"`,
      `"Date Range:","${from} to ${to}"`,
      `"Total Expenses:","${expenses.length}"`,
      `"Total Amount:","${totalAmount.toFixed(2)}"`,
      "",
    ];

    const csv = [...summaryRows, headers.join(","), ...rows].join("\n");
    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="expense_report_${dateStr}.csv"`,
      },
    });
  });
}
