import { PageWrapper } from "@/components/page-wrapper";
import { ARBSaleCreateComponent } from "../components/arb-sale-create";

export default function Page() {
  return (
    <PageWrapper title="Add ARB Sale" showBackButton>
      <ARBSaleCreateComponent />
    </PageWrapper>
  );
}
