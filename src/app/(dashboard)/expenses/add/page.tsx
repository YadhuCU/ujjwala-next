import { PageWrapper } from "@/components/page-wrapper";
import { ExpenseCreateComponent } from "../components/expense-create";

export default function Page() {
  return (
    <PageWrapper title="Add Expense" showBackButton>
      <ExpenseCreateComponent />
    </PageWrapper>
  );
}
