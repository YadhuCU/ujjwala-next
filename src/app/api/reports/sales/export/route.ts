import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(async ({ userId, role }) => {
    const url = request.nextUrl;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const customerId = url.searchParams.get("customerId");
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

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        product: { select: { name: true } },
        stock: { select: { batchNo: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate summary
    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalNetTotal = 0;
    for (const s of sales) {
      const price = Number(s.salePrice ?? 0);
      const qty = s.quantity;
      const sub = price * qty;
      const disc = s.discount ? (sub * s.discount) / 100 : 0;
      totalSubtotal += sub;
      totalDiscount += disc;
      totalNetTotal += Number(s.netTotal ?? 0);
    }

    if (format === "pdf") {
      // Generate CSV-style text report as PDF alternative
      // (PDF libraries are heavy; we generate a formatted CSV for now)
      const lines: string[] = [];
      lines.push("SALE REPORT");
      lines.push(`Date Range: ${from} to ${to}`);
      lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
      lines.push("");
      lines.push("SUMMARY");
      lines.push(`Total Invoices: ${sales.length}`);
      lines.push(`Total Subtotal: ${totalSubtotal.toFixed(2)}`);
      lines.push(`Total Discount: ${totalDiscount.toFixed(2)}`);
      lines.push(`Total Net Total: ${totalNetTotal.toFixed(2)}`);
      lines.push("");
      lines.push(
        [
          "Invoice No",
          "Date",
          "Customer",
          "Staff",
          "Product",
          "Batch",
          "Qty",
          "Price",
          "Discount %",
          "Net Total",
        ].join("\t")
      );

      for (const s of sales) {
        lines.push(
          [
            s.trNo || "",
            new Date(s.createdAt).toLocaleDateString("en-IN"),
            s.customer?.name || "",
            s.createdBy?.name || "",
            s.product?.name || "",
            s.stock?.batchNo || "",
            s.quantity.toString(),
            s.salePrice?.toString() || "0",
            s.discount?.toString() || "0",
            s.netTotal?.toString() || "0",
          ].join("\t")
        );
      }

      const content = lines.join("\n");
      const dateStr = new Date().toISOString().split("T")[0];

      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="sale_report_${dateStr}.txt"`,
        },
      });
    }

    // Default: Excel (CSV format — works in Excel)
    const headers = [
      "Invoice No",
      "Date",
      "Customer",
      "Staff",
      "Product",
      "Batch",
      "Qty",
      "Price",
      "Discount %",
      "Net Total",
    ];

    const rows = sales.map((s) =>
      [
        s.trNo || "",
        new Date(s.createdAt).toLocaleDateString("en-IN"),
        s.customer?.name || "",
        s.createdBy?.name || "",
        s.product?.name || "",
        s.stock?.batchNo || "",
        s.quantity.toString(),
        s.salePrice?.toString() || "0",
        s.discount?.toString() || "0",
        s.netTotal?.toString() || "0",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    // Add summary rows at top
    const summaryRows = [
      `"SALE REPORT"`,
      `"Date Range:","${from} to ${to}"`,
      `"Total Invoices:","${sales.length}"`,
      `"Total Subtotal:","${totalSubtotal.toFixed(2)}"`,
      `"Total Discount:","${totalDiscount.toFixed(2)}"`,
      `"Total Net Total:","${totalNetTotal.toFixed(2)}"`,
      "",
    ];

    const csv = [...summaryRows, headers.join(","), ...rows].join("\n");
    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sale_report_${dateStr}.csv"`,
      },
    });
  });
}
