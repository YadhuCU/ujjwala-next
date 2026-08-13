import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { RecordPaymentSchema } from "@/module/customer-txn/customer-txn.payload.schema";
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service";
import { serializeLedgerEntry } from "@/module/customer-txn/customer-txn.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

// A payment that arrives outside any invoice — customer walks in and pays.
export async function POST(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id } = await params;
      const data = RecordPaymentSchema.parse(await req.json());

      const { ledgerEntry, pendingAmount } =
        await CustomerTxnService.recordPayment(
          Number(id),
          data,
          Number(userId),
        );

      return formatResponse({
        data: {
          ledgerEntry: serializeLedgerEntry(ledgerEntry),
          pendingAmount: Number(pendingAmount),
        },
        status: 201,
        message: "Payment recorded successfully",
      });
    },
    [PERMISSIONS.CUSTOMER_UPDATE],
  );
}
