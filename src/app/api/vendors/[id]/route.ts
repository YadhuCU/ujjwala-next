import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { NotFoundError } from "@/lib/errors";
import { formatResponse } from "@/lib/response";
import { serializeVendor } from "@/module/vendor/vendor.serializer";
import { VendorUpdateSchema } from "@/module/vendor/vendor.schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const vendor = await prisma.vendor.findUnique({
      where: { id: parseInt(id) },
    });
    if (!vendor) {
      throw new NotFoundError("Vendor not found.");
    }
    return formatResponse({ data: serializeVendor(vendor) });
  }, [PERMISSIONS.VENDOR_READ]);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const json = await request.json();
    const data = VendorUpdateSchema.parse(json);

    const vendor = await prisma.vendor.update({
      where: { id: parseInt(id) },
      data,
    });

    return formatResponse({
      data: serializeVendor(vendor),
      message: "Vendor updated successfully.",
    });
  }, [PERMISSIONS.VENDOR_UPDATE]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.vendor.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true },
    });
    return formatResponse({
      data: null,
      message: "Vendor deleted successfully",
    });
  }, [PERMISSIONS.VENDOR_DELETE]);
}
