import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { UpdateLocationSchema } from "@/module/location/location.payload.schema";
import * as LocationService from "@/module/location/location.service";
import { serializeLocation } from "@/module/location/location.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const location = await LocationService.getLocationById(Number(id));
    return formatResponse({ data: serializeLocation(location) });
  }, [PERMISSIONS.LOCATION_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const data = UpdateLocationSchema.parse(await req.json());

    const location = await LocationService.updateLocation(Number(id), data);

    return formatResponse({
      data: serializeLocation(location),
      message: "Location updated successfully",
    });
  }, [PERMISSIONS.LOCATION_UPDATE]);
}

export async function DELETE(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;

    await LocationService.deleteLocation(Number(id));

    return formatResponse({
      data: null,
      message: "Location deleted successfully",
    });
  }, [PERMISSIONS.LOCATION_DELETE]);
}
