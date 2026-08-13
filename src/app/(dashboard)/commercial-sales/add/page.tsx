import { PageWrapper } from "@/components/page-wrapper";
import { CommercialSaleCreateComponent } from "../components/commercial-sale-create";

export default function Page() {
  return (
    <PageWrapper title="Add Commercial Sale" showBackButton>
      <CommercialSaleCreateComponent />
    </PageWrapper>
  );
}
