export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SalesClient } from "./sales-client";

export default async function SalesPage() {
  const sales = await prisma.sale.findMany({
    where: { isDeleted: false },
    include: { stock: true, customer: true, product: true },
    orderBy: { createdAt: "desc" },
  });
  return <SalesClient sales={JSON.parse(JSON.stringify(sales))} />;
}
