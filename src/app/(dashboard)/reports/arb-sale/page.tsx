import { PageWrapper } from "@/components/page-wrapper";
import { SaleReportView } from "../_components/sale-report-view";

export default function Page() {
  return (
    <PageWrapper
      title="ARB Sale Report"
      description="Bulk ARB invoices with totals for the selected range."
    >
      <SaleReportView kind="arb" />
    </PageWrapper>
  );
}
