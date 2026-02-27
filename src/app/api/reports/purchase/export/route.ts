import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const url = request.nextUrl;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const vendorId = url.searchParams.get("vendorId");
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
      purchaseDate: { gte: fromDate, lte: toDate },
    };

    if (vendorId && vendorId !== "all") {
      where.vendorId = parseInt(vendorId);
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        vendor: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    let totalAmount = 0;
    for (const p of purchases) {
      totalAmount += Number(p.totalAmount ?? 0);
    }

    interface ExportRow {
      invoiceNo: string;
      date: string;
      vendor: string;
      products: string;
      batches: string;
      amount: string;
    }
    
    const exportData: ExportRow[] = purchases.map((p) => ({
      invoiceNo: p.invoiceNo || "",
      date: new Date(p.purchaseDate).toLocaleDateString("en-IN"),
      vendor: p.vendor?.name || "",
      products: p.items.map((i) => `${i.product?.name ?? ""} (${i.quantity})`).join(", "),
      batches: p.items.map((i) => i.batchNo).filter(Boolean).join(", "),
      amount: p.totalAmount?.toString() || "0",
    }));

    if (format === "pdf") {
      const lines: string[] = [];
      lines.push("PURCHASE REPORT");
      lines.push(`Date Range: ${from} to ${to}`);
      lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
      lines.push("");
      lines.push("SUMMARY");
      lines.push(`Total Invoices: ${purchases.length}`);
      lines.push(`Total Amount: ${totalAmount.toFixed(2)}`);
      lines.push("");
      lines.push(["Invoice No", "Date", "Vendor", "Products (Qty)", "Batches", "Total Amount"].join("\t"));

      for (const row of exportData) {
        lines.push(
          [
            row.invoiceNo,
            row.date,
            row.vendor,
            row.products,
            row.batches,
            row.amount,
          ].join("\t")
        );
      }

      const content = lines.join("\n");
      const dateStr = new Date().toISOString().split("T")[0];

      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="purchase_report_${dateStr}.txt"`,
        },
      });
    }

    const headers = ["Invoice No", "Date", "Vendor", "Products (Qty)", "Batches", "Total Amount"];

    const rows = exportData.map((row) =>
      [
            row.invoiceNo,
            row.date,
            row.vendor,
            row.products,
            row.batches,
            row.amount,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    const summaryRows = [
      `"PURCHASE REPORT"`,
      `"Date Range:","${from} to ${to}"`,
      `"Total Invoices:","${purchases.length}"`,
      `"Total Amount:","${totalAmount.toFixed(2)}"`,
      "",
    ];

    const csv = [...summaryRows, headers.join(","), ...rows].join("\n");
    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="purchase_report_${dateStr}.csv"`,
      },
    });
  });
}
