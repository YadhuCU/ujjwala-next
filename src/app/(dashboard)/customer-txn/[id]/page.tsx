"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { CustomerTxnViewComponent } from "./components/customer-txn-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.CUSTOMER_READ}>
      <PageWrapper
        title="Customer Transactions"
        description="Money owed, cylinders held, and every ledger entry behind them."
        showBackButton
      >
        <CustomerTxnViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
