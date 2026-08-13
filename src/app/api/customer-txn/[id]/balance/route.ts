import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service";
import { serializeCustomerSummary } from "@/module/customer-txn/customer-txn.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const summary = await CustomerTxnService.getCustomerSummary(Number(id));
    return formatResponse({ data: serializeCustomerSummary(summary) });
  }, [PERMISSIONS.CUSTOMER_READ]);
}
