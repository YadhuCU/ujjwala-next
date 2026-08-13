import { PageWrapper } from "@/components/page-wrapper";
import { ExpenseUpdateComponent } from "../../components/expense-update";

export default function Page() {
  return (
    <PageWrapper title="Edit Expense" showBackButton>
      <ExpenseUpdateComponent />
    </PageWrapper>
  );
}
