import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service";
import { serializeLedgerEntry } from "@/module/customer-txn/customer-txn.serializer";

type Props = {
  params: Promise<{ id: string; paymentId: string }>;
};

// Payments are never deleted — this appends an ADJUSTMENT row that puts the
// money back on the customer's balance.
export async function DELETE(_req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: userId }) => {
      const { id, paymentId } = await params;

      const { ledgerEntry, pendingAmount } =
        await CustomerTxnService.reversePayment(
          Number(id),
          Number(paymentId),
          Number(userId),
        );

      return formatResponse({
        data: {
          ledgerEntry: serializeLedgerEntry(ledgerEntry),
          pendingAmount: Number(pendingAmount),
        },
        message: "Payment reversed successfully",
      });
    },
    [PERMISSIONS.CUSTOMER_UPDATE],
  );
}
