import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { TransactionQuerySchema } from "@/module/customer-txn/customer-txn.payload.schema";
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service";
import { serializeLedgerEntries } from "@/module/customer-txn/customer-txn.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const query = TransactionQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const result = await CustomerTxnService.getCustomerTransactions(
      Number(id),
      query,
    );

    return formatResponse({
      data: serializeLedgerEntries(result.data),
      meta: result.meta,
    });
  }, [PERMISSIONS.CUSTOMER_READ]);
}
