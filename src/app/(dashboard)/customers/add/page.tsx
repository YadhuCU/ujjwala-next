import { PageWrapper } from "@/components/page-wrapper";
import { CustomerCreateComponent } from "../components/customer-create";

export default function AddCustomerPage() {
  return (
    <PageWrapper title="Add Customer" showBackButton>
      <CustomerCreateComponent />
    </PageWrapper>
  );
}
