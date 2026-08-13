import { PageWrapper } from "@/components/page-wrapper";
import { CustomerTxnViewComponent } from "./components/customer-txn-view";

export default function Page() {
  return (
    <PageWrapper
      title="Customer Transactions"
      description="Money owed, cylinders held, and every ledger entry behind them."
      showBackButton
    >
      <CustomerTxnViewComponent />
    </PageWrapper>
  );
}
