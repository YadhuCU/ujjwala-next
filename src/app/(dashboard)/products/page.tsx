"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProductsViewComponent } from "./components/product-view";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function ProductsPage() {
  const { hasPermission } = usePermission();

  const createPermisson = hasPermission(PERMISSIONS.PRODUCT_CREATE);
  return (
    <PageWrapper
      title="Products"
      addButton={
        createPermisson && (
          <Button asChild className="ml-auto">
            <Link href="/products/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Link>
          </Button>
        )
      }
    >
      <ProductsViewComponent />
    </PageWrapper>
  );
}
