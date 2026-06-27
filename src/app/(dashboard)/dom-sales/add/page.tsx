import { PageWrapper } from "@/components/page-wrapper";
import { DomSaleCreateComponent } from "../components/dom-sale-create";

export default function AddDomSalePage() {
  return (
    <PageWrapper title="Add Domestic Sale" showBackButton>
      <DomSaleCreateComponent />
    </PageWrapper>
  );
}
