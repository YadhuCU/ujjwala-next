import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { ARBSalesViewComponent } from "./components/arb-sale-view";

export default function Page() {
  return (
    <PageWrapper
      title="ARB Sales"
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/arb-sales/add">
            <Plus className="w-4 h-4 mr-2" />
            Add ARB Sale
          </Link>
        </Button>
      }
    >
      <ARBSalesViewComponent />
    </PageWrapper>
  );
}
