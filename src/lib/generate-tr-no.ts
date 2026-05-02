import { prisma } from "@/lib/prisma";

/**
 * Generates a transaction number like Django's generate_tr_no
 * Format: PREFIX-YYYYMMDD-NNN (e.g., CS-20260214-001)
 */
export async function generateTrNo(
  transactionType: "sale" | "dom_sale" | "collection" | "arbSale" | "commercialSale"
): Promise<string> {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");

  const prefixMap = {
    sale: "CS",
    dom_sale: "DS",
    collection: "CL",
    arbSale: "AS",
    commercialSale: "CM",
  };

  const prefix = prefixMap[transactionType];
  const pattern = `${prefix}-${dateStr}-`;

  let lastNo = 0;

  if (transactionType === "sale") {
    const last = await prisma.sale.findFirst({
      where: { trNo: { startsWith: pattern } },
      orderBy: { trNo: "desc" },
    });
    if (last?.trNo) {
      const parts = last.trNo.split("-");
      lastNo = parseInt(parts[parts.length - 1]) || 0;
    }
  } else if (transactionType === "dom_sale") {
    const last = await prisma.domSale.findFirst({
      where: { trNo: { startsWith: pattern } },
      orderBy: { trNo: "desc" },
    });
    if (last?.trNo) {
      const parts = last.trNo.split("-");
      lastNo = parseInt(parts[parts.length - 1]) || 0;
    }
  } else if (transactionType === "collection") {
    const last = await prisma.collection.findFirst({
      where: { trNo: { startsWith: pattern } },
      orderBy: { trNo: "desc" },
    });
    if (last?.trNo) {
      const parts = last.trNo.split("-");
      lastNo = parseInt(parts[parts.length - 1]) || 0;
    }
  } else if (transactionType === "arbSale") {
    const last = await prisma.arbSale.findFirst({
      where: { trNo: { startsWith: pattern } },
      orderBy: { trNo: "desc" },
    });
    if (last?.trNo) {
      const parts = last.trNo.split("-");
      lastNo = parseInt(parts[parts.length - 1]) || 0;
    }
  } else if (transactionType === "commercialSale") {
    const last = await prisma.commercialSale.findFirst({
      where: { trNo: { startsWith: pattern } },
      orderBy: { trNo: "desc" },
    });
    if (last?.trNo) {
      const parts = last.trNo.split("-");
      lastNo = parseInt(parts[parts.length - 1]) || 0;
    }
  }

  return `${pattern}${(lastNo + 1).toString().padStart(3, "0")}`;
}
