import { Prisma, Customer, Location } from "@/generated/client";

type SerializeCustomerPayload = Customer & {
  location?: Location | null;
};

type SerializeCustomerWithDetailsPayload = Prisma.CustomerGetPayload<{
  include: {
    location: true;
    initialCylinderBalances: true;
  };
}>;

export function serializeCustomer(customer: SerializeCustomerPayload) {
  return {
    ...customer,

    phone: customer.phone ?? undefined,
    address: customer.address ?? undefined,

    locationId: customer.locationId ?? undefined,

    concernedPerson: customer.concernedPerson ?? undefined,

    concernedPersonMobile: customer.concernedPersonMobile ?? undefined,

    discount: customer.discount ?? undefined,

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
