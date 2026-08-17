import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeProduct, makeUser } from "@/test/factories";
import * as CustomerService from "./customer.service";
import * as LocationService from "@/module/location/location.service";

let userId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
});

function customerInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Hotel Blue",
    phone: "9876543210",
    address: "Beach Road",
    locationId: undefined,
    discount: 5,
    concernedPerson: "Manager",
    concernedPersonMobile: "9876500000",
    gstNumber: undefined,
    initialPendingAmount: 0,
    initialCylinderBalances: [],
    ...overrides,
  };
}

describe("updateCustomer", () => {
  it("updates the header fields", async () => {
    const created = await CustomerService.createCustomer(
      customerInput(),
      userId,
    );

    const updated = await CustomerService.updateCustomer(created.id, {
      name: "Hotel Green",
      phone: "9000000000",
      address: undefined,
      locationId: undefined,
      discount: 10,
      concernedPerson: undefined,
      concernedPersonMobile: undefined,
      gstNumber: undefined,
    });

    expect(updated.name).toBe("Hotel Green");
    expect(updated.phone).toBe("9000000000");
    expect(updated.discount).toBe(10);
    // Fields left out of the payload are cleared, not silently kept
    expect(updated.address).toBeNull();
  });

  // Opening balances are migration data — the update payload does not carry
  // them, so a later edit must not disturb what was captured at registration.
  it("leaves the opening balances untouched", async () => {
    const product = await makeProduct();

    const created = await CustomerService.createCustomer(
      customerInput({
        initialPendingAmount: 750,
        initialCylinderBalances: [{ productId: product.id, qty: 4 }],
      }),
      userId,
    );

    await CustomerService.updateCustomer(created.id, {
      name: "Renamed",
      phone: undefined,
      address: undefined,
      locationId: undefined,
      discount: undefined,
      concernedPerson: undefined,
      concernedPersonMobile: undefined,
      gstNumber: undefined,
    });

    const after = await prisma.customer.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(Number(after.initialPendingAmount)).toBe(750);

    const opening = await prisma.customerInitialCylinderBalance.findUniqueOrThrow(
      { where: { customerId_productId: { customerId: created.id, productId: product.id } } },
    );
    expect(opening.qty).toBe(4);

    // And the live ledger still reflects what they hold
    const ledger = await prisma.customerCylinderLedger.findUniqueOrThrow({
      where: {
        productId_customerId: { customerId: created.id, productId: product.id },
      },
    });
    expect(ledger.pendingCylinder).toBe(4);
  });

  it("rejects an unknown customer", async () => {
    await expect(
      CustomerService.updateCustomer(9999, {
        name: "Ghost",
        phone: undefined,
        address: undefined,
        locationId: undefined,
        discount: undefined,
        concernedPerson: undefined,
        concernedPersonMobile: undefined,
        gstNumber: undefined,
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("getCustomers", () => {
  it("hides deleted customers", async () => {
    const kept = await CustomerService.createCustomer(
      customerInput({ name: "Kept" }),
      userId,
    );
    const gone = await CustomerService.createCustomer(
      customerInput({ name: "Gone" }),
      userId,
    );

    await CustomerService.deleteCustomer(gone.id);

    const list = await CustomerService.getCustomers({});
    expect(list.map((c) => c.id)).toEqual([kept.id]);
  });

  it("searches by name and phone", async () => {
    await CustomerService.createCustomer(
      customerInput({ name: "Seaside Hotel", phone: "9111111111" }),
      userId,
    );
    await CustomerService.createCustomer(
      customerInput({ name: "Hilltop Cafe", phone: "9222222222" }),
      userId,
    );

    const byName = await CustomerService.getCustomers({ search: "seaside" });
    expect(byName.map((c) => c.name)).toEqual(["Seaside Hotel"]);

    const byPhone = await CustomerService.getCustomers({ search: "9222" });
    expect(byPhone.map((c) => c.name)).toEqual(["Hilltop Cafe"]);
  });

  it("filters by location", async () => {
    const location = await LocationService.createLocation({
      name: "Kozhikode",
      district: undefined,
      locality: undefined,
      pincode: undefined,
    });

    await CustomerService.createCustomer(
      customerInput({ name: "Local", locationId: location.id }),
      userId,
    );
    await CustomerService.createCustomer(
      customerInput({ name: "Elsewhere" }),
      userId,
    );

    const list = await CustomerService.getCustomers({
      locationId: location.id,
    });
    expect(list.map((c) => c.name)).toEqual(["Local"]);
  });
});

describe("getCustomerById", () => {
  it("returns the opening cylinder balances with the record", async () => {
    const product = await makeProduct();

    const created = await CustomerService.createCustomer(
      customerInput({
        initialCylinderBalances: [{ productId: product.id, qty: 2 }],
      }),
      userId,
    );

    const found = await CustomerService.getCustomerById(created.id);
    expect(found.initialCylinderBalances).toHaveLength(1);
    expect(found.initialCylinderBalances[0].qty).toBe(2);
  });

  it("refuses a deleted customer", async () => {
    const created = await CustomerService.createCustomer(
      customerInput(),
      userId,
    );
    await CustomerService.deleteCustomer(created.id);

    await expect(
      CustomerService.getCustomerById(created.id),
    ).rejects.toThrow(/not found/);
  });
});
