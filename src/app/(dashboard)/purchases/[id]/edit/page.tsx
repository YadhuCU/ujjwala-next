import { PageWrapper } from "@/components/page-wrapper";
import { UpdatePurchaseComponent } from "../../components/purchase-update";

export default function EditPurchasePage() {
  return (
    <PageWrapper title="Edit Purchase" showBackButton>
      <UpdatePurchaseComponent />
    </PageWrapper>
  );
}
