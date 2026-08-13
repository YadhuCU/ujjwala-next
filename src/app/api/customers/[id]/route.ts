import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { UpdateCustomerSchema } from "@/module/customer/customer.payload.schema";
import * as CustomerService from "@/module/customer/customer.service";
import { serializeCustomerWithDetails } from "@/module/customer/customer.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const customer = await CustomerService.getCustomerById(Number(id));
    return formatResponse({ data: serializeCustomerWithDetails(customer) });
  }, [PERMISSIONS.CUSTOMER_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const data = UpdateCustomerSchema.parse(await req.json());

    const customer = await CustomerService.updateCustomer(Number(id), data);

    return formatResponse({
      data: serializeCustomerWithDetails(customer),
      message: "Customer updated successfully",
    });
  }, [PERMISSIONS.CUSTOMER_UPDATE]);
}

export async function DELETE(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;

    await CustomerService.deleteCustomer(Number(id));

    return formatResponse({
      data: null,
      message: "Customer deleted successfully",
    });
  }, [PERMISSIONS.CUSTOMER_DELETE]);
}
