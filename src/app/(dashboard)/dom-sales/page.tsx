import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DomSalesViewComponent } from "./components/dom-sale-view";

export default function DomSalesPage() {
  return (
    <PageWrapper
      title="Domestic Sales"
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/dom-sales/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Domestic Sale
          </Link>
        </Button>
      }
    >
      <DomSalesViewComponent />
    </PageWrapper>
  );
}
