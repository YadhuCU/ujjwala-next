import { Location } from "@/generated/client";

export function serializeLocation(location: Location) {
  return {
    ...location,
    name: location.name ?? undefined,
    district: location.district ?? undefined,
    locality: location.locality ?? undefined,
    pincode: location.pincode ?? undefined,
  };
}

export type LocationResponse = ReturnType<typeof serializeLocation>;
