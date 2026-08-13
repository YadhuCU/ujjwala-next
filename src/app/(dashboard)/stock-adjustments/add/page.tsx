import { PageWrapper } from "@/components/page-wrapper";
import { StockAdjustmentCreateComponent } from "../components/stock-adjustment-create";

export default function Page() {
  return (
    <PageWrapper title="New Stock Adjustment" showBackButton>
      <StockAdjustmentCreateComponent />
    </PageWrapper>
  );
}
