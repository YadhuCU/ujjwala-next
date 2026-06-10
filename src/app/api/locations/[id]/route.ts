import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { NotFoundError } from "@/lib/errors";
import { serializeLocation } from "@/module/location/location.serializer";
import { formatResponse } from "@/lib/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const location = await prisma.location.findUnique({
      where: { id: parseInt(id) },
    });
    if (!location) {
      throw new NotFoundError("Not found");
    }
    return formatResponse({ data: serializeLocation(location), status: 200 });
  }, [PERMISSIONS.LOCATION_READ]);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const data = await request.json();
    const location = await prisma.location.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        district: data.district,
        pincode: data.pincode,
        locality: data.locality,
      },
    });
    return formatResponse({ data: serializeLocation(location), status: 200 });
  }, [PERMISSIONS.LOCATION_UPDATE]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.location.delete({
      where: { id: parseInt(id) },
    });
    return formatResponse({
      data: null,
      message: "Deleted successfully",
      status: 200,
    });
  }, [PERMISSIONS.LOCATION_DELETE]);
}
