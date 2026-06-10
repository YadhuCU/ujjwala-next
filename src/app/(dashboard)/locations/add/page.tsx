"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { LocationCreateComponent } from "../components/location-create";

export default function AddLocationPage() {
  return (
    <PageWrapper title="Add Location" showBackButton>
      <LocationCreateComponent />
    </PageWrapper>
  );
}
