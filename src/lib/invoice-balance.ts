// A sale invoice may be paid in part, in full, or for more than it comes to —
// the customer often settles an earlier invoice's due on the next visit. The
// money ledger needs nothing special for that: SALE_CHARGE +total, PAYMENT
// −paid, and the customer's balance moves by the difference.
//
// What does need care is showing one invoice on its own. "Total − paid" goes
// negative when the payment covered an earlier due, so a list or report would
// show this invoice as owing a negative amount. This splits it instead: what is
// still due on this invoice (never below zero) and how much of the payment went
// toward what the customer already owed. The customer's true outstanding is
// always the ledger's (`CustomerBalance`), never a sum of these.

export type InvoiceBalance = {
  /** Still owed on this invoice. Never negative. */
  balance: number;
  /** The part of the payment beyond this invoice, applied to earlier dues. */
  towardEarlierDue: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function invoiceBalance(
  totalAmount: number | null | undefined,
  paidAmount: number | null | undefined,
): InvoiceBalance {
  const net = round2(Number(totalAmount ?? 0) - Number(paidAmount ?? 0));
  return net >= 0
    ? { balance: net, towardEarlierDue: 0 }
    : { balance: 0, towardEarlierDue: -net };
}
