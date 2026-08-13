import { PageWrapper } from "@/components/page-wrapper";
import { CommercialSaleUpdateComponent } from "../../components/commercial-sale-update";

export default function Page() {
  return (
    <PageWrapper title="Edit Commercial Sale" showBackButton>
      <CommercialSaleUpdateComponent />
    </PageWrapper>
  );
}
