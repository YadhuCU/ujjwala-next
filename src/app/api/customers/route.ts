import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateCustomerSchema,
  CustomerQuerySchema,
} from "@/module/customer/customer.payload.schema";
import * as CustomerService from "@/module/customer/customer.service";
import {
  serializeCustomers,
  serializeCustomerWithDetails,
} from "@/module/customer/customer.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = CustomerQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const customers = await CustomerService.getCustomers(query);

    return formatResponse({ data: serializeCustomers(customers) });
  }, [PERMISSIONS.CUSTOMER_READ]);
}

export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const data = CreateCustomerSchema.parse(await request.json());
      const customer = await CustomerService.createCustomer(data, Number(id));

      return formatResponse({
        data: serializeCustomerWithDetails(customer),
        status: 201,
        message: "Customer created successfully",
      });
    },
    [PERMISSIONS.CUSTOMER_CREATE],
  );
}
