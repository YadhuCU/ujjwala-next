import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "@/test/factories";
import * as LocationService from "./location.service";
import * as CustomerService from "@/module/customer/customer.service";

// Locations are the one hard delete in the app: no history of their own, and
// Customer.locationId is SetNull.
describe("deleteLocation", () => {
  it("removes the row and leaves customers without a grouping", async () => {
    const user = await makeUser();
    const location = await LocationService.createLocation({
      name: "Kozhikode",
      district: undefined,
      locality: undefined,
      pincode: undefined,
    });

    const customer = await CustomerService.createCustomer(
      {
        name: "Local Customer",
        phone: undefined,
        address: undefined,
        locationId: location.id,
        discount: undefined,
        concernedPerson: undefined,
        concernedPersonMobile: undefined,
        gstNumber: undefined,
        initialPendingAmount: 0,
        initialCylinderBalances: [],
      },
      user.id,
    );

    await LocationService.deleteLocation(location.id);

    expect(await prisma.location.count()).toBe(0);

    const survivor = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(survivor.locationId).toBeNull();
    expect(survivor.isDeleted).toBe(false);
  });
});
