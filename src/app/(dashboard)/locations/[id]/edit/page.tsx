"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import LocationUpdateComponent from "../../components/location-update";

export default function EditLocationPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.LOCATION_UPDATE}>
      <PageWrapper title="Edit Location" showBackButton>
        <LocationUpdateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
