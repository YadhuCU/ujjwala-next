// app/api/customers/[id]/transactions/route.ts
import { NextRequest } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { formatResponse } from "@/lib/response"
import { TransactionQuerySchema } from "@/module/customer-txn/customer-txn.schema"
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const query = TransactionQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    const result = await CustomerTxnService.getCustomerTransactions(Number(params.id), query)
    return formatResponse({ data: result.data, meta: result.meta })
  }, [PERMISSIONS.CUSTOMER_READ])
}