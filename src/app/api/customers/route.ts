import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { CreateCustomerSchema } from "@/module/customer/customer.schema";
import { LedgerEntryType, RefType } from "@/generated/enums";
import { serializeCustomer } from "@/module/customer/customer.serializer";

export async function GET() {
  return withAuth(async () => {
    const customers = await prisma.customer.findMany({
      where: { isDeleted: false },
      include: { location: true },
      orderBy: { createdAt: "desc" },
    });
    return formatResponse({
      data: customers.map(serializeCustomer),
      message: "",
    });
  }, [PERMISSIONS.CUSTOMER_READ]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const json = await request.json();
    const { initialCylinderBalances, ...data } =
      CreateCustomerSchema.parse(json);

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({ data });

      // Seed per-product opening cylinder balances
      for (const entry of initialCylinderBalances) {
        const productId = entry.productId;
        const qty = Number(entry.qty) || 0;
        if (!productId || qty <= 0) continue;

        await tx.customerInitialCylinderBalance.upsert({
          where: {
            customerId_productId: { customerId: created.id, productId },
          },
          update: { qty },
          create: { customerId: created.id, productId, qty },
        });
      }

      // Cylinder ledger
      for (const entry of initialCylinderBalances) {
        const productId = entry.productId;
        const qty = Number(entry.qty) || 0;
        if (!productId || qty <= 0) continue;

        await tx.customerCylinderLedger.upsert({
          where: {
            productId_customerId: {
              customerId: created.id,
              productId: entry.productId,
            },
          },
          update: { pendingCylinder: qty },
          create: { customerId: created.id, productId, pendingCylinder: qty },
        });
      }

      // Payment Ledger and Balance
      if (data.initialPendingAmount > 0) {
        await tx.customerPaymentLedger.create({
          data: {
            amount: data.initialPendingAmount,
            entryType: LedgerEntryType.OPENING,
            refId: created.id,
            refType: RefType.MANUAL,
            notes: "Opening balance at customer registration",
            customerId: created.id,
          },
        });

        await tx.customerBalance.create({
          data: {
            customerId: created.id,
            pendingAmount: data.initialPendingAmount,
          },
        });
      }

      return tx.customer.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          location: true,
          customerBalance: true,
          initialCylinderBalances: { include: { product: true } },
          customerCylinderLedgers: { include: { product: true } },
        },
      });
    });

    return formatResponse({
      data: customer,
      status: 201,
    });
  }, [PERMISSIONS.CUSTOMER_CREATE]);
}
