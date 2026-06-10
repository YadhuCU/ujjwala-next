import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { serializeLocation } from "@/module/location/location.serializer";
import { CreateLocationSchema } from "@/module/location/location.schema";

export async function GET() {
  return withAuth(async () => {
    const locations = await prisma.location.findMany({
      orderBy: { createdAt: "desc" },
    });
    return formatResponse({ data: locations.map(serializeLocation) });
  }, [PERMISSIONS.LOCATION_READ]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const json = await request.json();
    const data = CreateLocationSchema.parse(json);

    const location = await prisma.location.create({
      data,
    });
    return formatResponse({ data: serializeLocation(location), status: 201 });
  }, [PERMISSIONS.LOCATION_CREATE]);
}
