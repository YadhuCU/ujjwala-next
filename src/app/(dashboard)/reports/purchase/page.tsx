import { PageWrapper } from "@/components/page-wrapper";
import { PurchaseReportView } from "./components/purchase-report-view";

export default function Page() {
  return (
    <PageWrapper title="Purchase Report" description="Vendor deliveries and what they cost.">
      <PurchaseReportView />
    </PageWrapper>
  );
}
