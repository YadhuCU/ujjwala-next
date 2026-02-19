export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    where: { isDeleted: false },
    include: { location: true },
    orderBy: { createdAt: "desc" },
  });

  return <CustomersClient customers={JSON.parse(JSON.stringify(customers))} />;
}
