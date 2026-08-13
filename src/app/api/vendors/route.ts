import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateVendorSchema,
  VendorQuerySchema,
} from "@/module/vendor/vendor.payload.schema";
import * as VendorService from "@/module/vendor/vendor.service";
import { serializeVendor } from "@/module/vendor/vendor.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = VendorQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const vendors = await VendorService.getVendors(query);

    return formatResponse({ data: vendors.map(serializeVendor) });
  }, [PERMISSIONS.VENDOR_READ]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const data = CreateVendorSchema.parse(await request.json());
    const vendor = await VendorService.createVendor(data);

    return formatResponse({
      data: serializeVendor(vendor),
      status: 201,
      message: "Vendor created successfully",
    });
  }, [PERMISSIONS.VENDOR_CREATE]);
}
