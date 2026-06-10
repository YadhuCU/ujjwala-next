import { Vendor } from "@/generated/client";

export function serializeVendor(vendor: Vendor) {
  return {
    ...vendor,
    phone: vendor.phone ?? undefined,
    address: vendor.address ?? undefined,
    gstNumber: vendor.gstNumber ?? undefined,
  };
}

export type VendorResponse = ReturnType<typeof serializeVendor>;
