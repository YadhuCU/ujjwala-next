import { Prisma, Customer, Location } from "@/generated/client";

type SerializeCustomerPayload = Customer & {
  location?: Location | null;
  /** Only on the list, which shows what each customer owes and holds. */
  customerBalance?: { pendingAmount: Prisma.Decimal } | null;
  customerCylinderLedgers?: {
    productId: number;
    pendingCylinder: number;
    product: { name: string };
  }[];
};

type SerializeCustomerWithDetailsPayload = Prisma.CustomerGetPayload<{
  include: {
    location: true;
    initialCylinderBalances: true;
  };
}>;

export function serializeCustomer(customer: SerializeCustomerPayload) {
  const { customerBalance, customerCylinderLedgers, ...rest } = customer;

  return {
    ...rest,

    pendingAmount: customerBalance
      ? customerBalance.pendingAmount.toNumber()
      : undefined,

    pendingCylinders: customerCylinderLedgers?.map((ledger) => ({
      productId: ledger.productId,
      productName: ledger.product.name,
      quantity: ledger.pendingCylinder,
    })),

    phone: customer.phone ?? undefined,
    address: customer.address ?? undefined,

    locationId: customer.locationId ?? undefined,

    concernedPerson: customer.concernedPerson ?? undefined,

    concernedPersonMobile: customer.concernedPersonMobile ?? undefined,

    discount: customer.discount?.toNumber(),

    gstNumber: customer.gstNumber ?? undefined,

    location: customer.location ?? undefined,

    initialPendingAmount: customer.initialPendingAmount.toNumber(),
  };
}

export function serializeCustomerWithDetails(
  customer: SerializeCustomerWithDetailsPayload,
) {
  return {
    ...serializeCustomer(customer as SerializeCustomerPayload),
    initialCylinderBalances: customer.initialCylinderBalances.map(
      ({ productId, qty }) => ({ productId, qty }),
    ),
  };
}

export function serializeCustomers(
  customers: Parameters<typeof serializeCustomer>[0][],
) {
  return customers.map(serializeCustomer);
}

export type CustomerResponse = ReturnType<typeof serializeCustomerWithDetails>;
