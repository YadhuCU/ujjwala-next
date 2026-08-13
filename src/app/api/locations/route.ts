import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateLocationSchema,
  LocationQuerySchema,
} from "@/module/location/location.payload.schema";
import * as LocationService from "@/module/location/location.service";
import { serializeLocation } from "@/module/location/location.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = LocationQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const locations = await LocationService.getLocations(query);

    return formatResponse({ data: locations.map(serializeLocation) });
  }, [PERMISSIONS.LOCATION_READ]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const data = CreateLocationSchema.parse(await request.json());
    const location = await LocationService.createLocation(data);

    return formatResponse({
      data: serializeLocation(location),
      status: 201,
      message: "Location created successfully",
    });
  }, [PERMISSIONS.LOCATION_CREATE]);
}
