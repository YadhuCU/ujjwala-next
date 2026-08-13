import { PageWrapper } from "@/components/page-wrapper";
import { StockUpdateComponent } from "../../components/stock-update";

export default function Page() {
  return (
    <PageWrapper title="Edit Stock Batch" showBackButton>
      <StockUpdateComponent />
    </PageWrapper>
  );
}
