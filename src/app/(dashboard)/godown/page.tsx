import { PageWrapper } from "@/components/page-wrapper";
import { GodownViewComponent } from "./components/godown-view";

export default function Page() {
  return (
    <PageWrapper
      title="Godown"
      description="Filled and empty cylinders on hand, what customers are holding, and every movement behind the numbers."
    >
      <GodownViewComponent />
    </PageWrapper>
  );
}
