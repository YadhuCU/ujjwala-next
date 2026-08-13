import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { UpdateVendorSchema } from "@/module/vendor/vendor.payload.schema";
import * as VendorService from "@/module/vendor/vendor.service";
import { serializeVendor } from "@/module/vendor/vendor.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const vendor = await VendorService.getVendorById(Number(id));
    return formatResponse({ data: serializeVendor(vendor) });
  }, [PERMISSIONS.VENDOR_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const data = UpdateVendorSchema.parse(await req.json());

    const vendor = await VendorService.updateVendor(Number(id), data);

    return formatResponse({
      data: serializeVendor(vendor),
      message: "Vendor updated successfully",
    });
  }, [PERMISSIONS.VENDOR_UPDATE]);
}

export async function DELETE(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;

    await VendorService.deleteVendor(Number(id));

    return formatResponse({
      data: null,
      message: "Vendor deleted successfully",
    });
  }, [PERMISSIONS.VENDOR_DELETE]);
}
