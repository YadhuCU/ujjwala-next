import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { CommercialSalesViewComponent } from "./components/commercial-sale-view";

export default function Page() {
  return (
    <PageWrapper
      title="Commercial Sales"
      description="Invoices with cylinder custody tracking for rented cylinders."
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/commercial-sales/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Commercial Sale
          </Link>
        </Button>
      }
    >
      <CommercialSalesViewComponent />
    </PageWrapper>
  );
}
