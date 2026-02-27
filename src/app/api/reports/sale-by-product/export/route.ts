import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const url = request.nextUrl;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
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

    const result = await prisma.$queryRaw<
      {
        product_id: number;
        product_name: string;
        total_quantity: bigint;
        total_amount: string | null;
      }[]
    >(Prisma.sql`
      WITH combined_sales AS (
        SELECT product_id, quantity, COALESCE(net_total, 0) as net_total, created_at 
        FROM sales WHERE is_deleted = false AND product_id IS NOT NULL
        UNION ALL
        SELECT product_id, quantity, COALESCE(net_total, 0) as net_total, created_at 
        FROM dom_sales WHERE is_deleted = false AND product_id IS NOT NULL
        UNION ALL
        SELECT i.product_id, i.quantity, COALESCE(i.net_total, 0) as net_total, a.created_at 
        FROM arb_sale_items i 
        JOIN arb_sales a ON i.arb_sale_id = a.id 
        WHERE a.is_deleted = false AND i.product_id IS NOT NULL
      )
      SELECT 
        p.id as product_id,
        p.name as product_name,
        SUM(c.quantity)::bigint as total_quantity,
        SUM(c.net_total)::text as total_amount
      FROM combined_sales c
      JOIN products p ON c.product_id = p.id
      WHERE c.created_at >= ${fromDate} AND c.created_at <= ${toDate}
      GROUP BY p.id, p.name
      ORDER BY SUM(c.net_total) DESC
    `);

    let totalQuantity = 0;
    let totalAmount = 0;

    const exportData = result.map(row => {
      const q = Number(row.total_quantity);
      const a = parseFloat(row.total_amount || "0");
      totalQuantity += q;
      totalAmount += a;
      return {
        product: row.product_name,
        quantity: q.toString(),
        amount: a.toFixed(2)
      };
    });

    if (format === "pdf") {
      const lines: string[] = [];
      lines.push("SALE BY PRODUCT REPORT");
      lines.push(`Date Range: ${from} to ${to}`);
      lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
      lines.push("");
      lines.push("SUMMARY");
      lines.push(`Total Products: ${exportData.length}`);
      lines.push(`Total Quantity: ${totalQuantity}`);
      lines.push(`Total Amount: ${totalAmount.toFixed(2)}`);
      lines.push("");
      lines.push(["Product", "Quantity", "Total Amount"].join("\t"));

      for (const row of exportData) {
        lines.push(
          [
            row.product,
            row.quantity,
            row.amount,
          ].join("\t")
        );
      }

      const content = lines.join("\n");
      const dateStr = new Date().toISOString().split("T")[0];

      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="sale_by_product_report_${dateStr}.txt"`,
        },
      });
    }

    const headers = ["Product", "Quantity", "Total Amount"];

    const rows = exportData.map((row) =>
      [
            row.product,
            row.quantity,
            row.amount,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    const summaryRows = [
      `"SALE BY PRODUCT REPORT"`,
      `"Date Range:","${from} to ${to}"`,
      `"Total Products:","${exportData.length}"`,
      `"Total Quantity:","${totalQuantity}"`,
      `"Total Amount:","${totalAmount.toFixed(2)}"`,
      "",
    ];

    const csv = [...summaryRows, headers.join(","), ...rows].join("\n");
    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sale_by_product_report_${dateStr}.csv"`,
      },
    });
  });
}
