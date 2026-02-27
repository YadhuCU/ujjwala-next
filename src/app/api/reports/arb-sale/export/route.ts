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

    const sales = await prisma.arbSale.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true } },
            stock: { select: { batchNo: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalNetTotal = 0;
    for (const s of sales) {
      const sub = Number(s.totalAmount ?? 0);
      const disc = Number(s.discount ?? 0);
      totalSubtotal += sub;
      totalDiscount += disc;
      totalNetTotal += (sub - disc);
    }

    interface ExportRow {
      trNo: string;
      date: string;
      customer: string;
      staff: string;
      products: string;
      batches: string;
      subtotal: string;
      discount: string;
      netTotal: string;
    }
    
    const exportData: ExportRow[] = sales.map((s) => ({
      trNo: s.trNo || "",
      date: new Date(s.createdAt).toLocaleDateString("en-IN"),
      customer: s.customer?.name || "",
      staff: s.createdBy?.name || "",
      products: s.items.map((i) => `${i.product?.name ?? ""} (${i.quantity})`).join(", "),
      batches: s.items.map((i) => i.stock?.batchNo ?? "").filter(Boolean).join(", "),
      subtotal: s.totalAmount?.toString() || "0",
      discount: s.discount?.toString() || "0",
      netTotal: (Number(s.totalAmount ?? 0) - Number(s.discount ?? 0)).toString(),
    }));

    if (format === "pdf") {
      const lines: string[] = [];
      lines.push("ARB SALE REPORT");
      lines.push(`Date Range: ${from} to ${to}`);
      lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
      lines.push("");
      lines.push("SUMMARY");
      lines.push(`Total Invoices: ${sales.length}`);
      lines.push(`Total Subtotal: ${totalSubtotal.toFixed(2)}`);
      lines.push(`Total Discount: ${totalDiscount.toFixed(2)}`);
      lines.push(`Total Net Total: ${totalNetTotal.toFixed(2)}`);
      lines.push("");
      lines.push(["Invoice No", "Date", "Customer", "Staff", "Products (Qty)", "Batches", "Subtotal", "Discount", "Net Total"].join("\t"));

      for (const row of exportData) {
        lines.push(
          [
            row.trNo,
            row.date,
            row.customer,
            row.staff,
            row.products,
            row.batches,
            row.subtotal,
            row.discount,
            row.netTotal,
          ].join("\t")
        );
      }

      const content = lines.join("\n");
      const dateStr = new Date().toISOString().split("T")[0];

      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="arb_sale_report_${dateStr}.txt"`,
        },
      });
    }

    const headers = ["Invoice No", "Date", "Customer", "Staff", "Products (Qty)", "Batches", "Subtotal", "Discount", "Net Total"];

    const rows = exportData.map((row) =>
      [
            row.trNo,
            row.date,
            row.customer,
            row.staff,
            row.products,
            row.batches,
            row.subtotal,
            row.discount,
            row.netTotal,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    const summaryRows = [
      `"ARB SALE REPORT"`,
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
        "Content-Disposition": `attachment; filename="arb_sale_report_${dateStr}.csv"`,
      },
    });
  });
}
