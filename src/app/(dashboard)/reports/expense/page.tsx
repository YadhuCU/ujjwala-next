import { PageWrapper } from "@/components/page-wrapper";
import { ExpenseReportView } from "./components/expense-report-view";

export default function Page() {
  return (
    <PageWrapper title="Expense Report" description="Recorded spending for the selected range.">
      <ExpenseReportView />
    </PageWrapper>
  );
}
