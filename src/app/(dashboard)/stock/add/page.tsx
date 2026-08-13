import { PageWrapper } from "@/components/page-wrapper";
import { StockCreateComponent } from "../components/stock-create";

export default function Page() {
  return (
    <PageWrapper title="Add Stock Batch" showBackButton>
      <StockCreateComponent />
    </PageWrapper>
  );
}
