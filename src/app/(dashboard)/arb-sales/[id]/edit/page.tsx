"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { api } from "@/lib/api-client";
import { useSuspenseQuery } from "@tanstack/react-query";
import ARBSaleUpdateComponent from "../../components/arb-sale-update";
import { useParams } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";
import { ArbSaleResponse } from "@/module/arb-sale/arb-sale.serializer";

export default function Page() {

  const params = useParams();
  const id = params.id as string;

  const { data } = useSuspenseQuery({
    queryKey: queryKeys.arbSales.detail(id),
    queryFn: () => api.getById<ArbSaleResponse>("arb-sales", id),
    select: (res) => res.data,
  });

  return (
    <PageWrapper
      title="Edit ARB Sale"
      showBackButton
      description={data.trNo ? `TR No: ${data.trNo}` : ""}
    >
      <ARBSaleUpdateComponent />
    </PageWrapper>
  );
}
