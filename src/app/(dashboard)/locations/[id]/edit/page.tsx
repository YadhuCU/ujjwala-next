"use client";

import { PageWrapper } from "@/components/page-wrapper";
import LocationUpdateComponent from "../../components/location-update";

export default function EditLocationPage() {
  return (
    <PageWrapper title="Edit Location" showBackButton>
      <LocationUpdateComponent />
    </PageWrapper>
  );
}
