"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { api } from "@/lib/api-client";
import { DomSaleResponse } from "@/module/dom-sale/dom-sale.serializer";
import { useSuspenseQuery } from "@tanstack/react-query";
import DomSaleUpdateComponent from "../../components/dom-sale-update";
import { useParams } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";

export default function EditDomSalePage() {

  const params = useParams();
  const id = params.id as string;

  const { data: domSale } = useSuspenseQuery({
    queryKey: queryKeys.domSales.detail(id),
    queryFn: () => api.getById<DomSaleResponse>("dom-sales", id),
    select: (res) => res.data,
  });

  return (
    <PageWrapper
      title="Edit Domestic Sale"
      showBackButton
      description={domSale.trNo ? `TR No: ${domSale.trNo}` : ""}
    >
      <DomSaleUpdateComponent />
    </PageWrapper>
  );
}
