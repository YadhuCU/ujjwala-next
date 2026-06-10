import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { VendorCreateSchema } from "@/module/vendor/vendor.schema";
import { formatResponse } from "@/lib/response";
import { serializeVendor } from "@/module/vendor/vendor.serializer";

export async function GET() {
  return withAuth(async () => {
    const vendors = await prisma.vendor.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });
    return formatResponse({ data: vendors.map(serializeVendor) });
  }, [PERMISSIONS.VENDOR_READ]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const json = await request.json();
    const data = VendorCreateSchema.parse(json);

    const vendor = await prisma.vendor.create({
      data,
    });
    return formatResponse({
      data: serializeVendor(vendor),
      status: 201,
      message: "Vendor created successfully.",
    });
  }, [PERMISSIONS.VENDOR_CREATE]);
}
