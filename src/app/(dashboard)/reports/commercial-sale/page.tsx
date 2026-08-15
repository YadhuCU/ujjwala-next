import { PageWrapper } from "@/components/page-wrapper";
import { SaleReportView } from "../_components/sale-report-view";

export default function Page() {
  return (
    <PageWrapper
      title="Commercial Sale Report"
      description="Commercial invoices, including cylinders still with customers."
    >
      <SaleReportView kind="commercial" />
    </PageWrapper>
  );
}
