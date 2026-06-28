// app/api/customers/[id]/balance/route.ts
import { NextRequest } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { formatResponse } from "@/lib/response"
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params
    console.log({ id })
    const summary = await CustomerTxnService.getCustomerSummary(Number(id))
    return formatResponse({ data: summary })
  }, [PERMISSIONS.CUSTOMER_READ])
}