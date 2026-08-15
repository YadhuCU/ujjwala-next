import { PageWrapper } from "@/components/page-wrapper";
import { SaleReportView } from "../_components/sale-report-view";

export default function Page() {
  return (
    <PageWrapper
      title="Domestic Sale Report"
      description="Domestic invoices with totals for the selected range."
    >
      <SaleReportView kind="dom" />
    </PageWrapper>
  );
}
