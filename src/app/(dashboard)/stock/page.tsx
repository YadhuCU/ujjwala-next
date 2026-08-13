import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { StockViewComponent } from "./components/stock-view";

export default function Page() {
  return (
    <PageWrapper
      title="Stock"
      description="Batches on hand. Purchases create batches automatically — add one here only for opening stock."
      addButton={
        <Button asChild className="ml-auto">
          <Link href="/stock/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Stock Batch
          </Link>
        </Button>
      }
    >
      <StockViewComponent />
    </PageWrapper>
  );
}
