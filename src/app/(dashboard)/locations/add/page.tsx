"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { LocationCreateComponent } from "../components/location-create";

export default function AddLocationPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.LOCATION_CREATE}>
      <PageWrapper title="Add Location" showBackButton>
        <LocationCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
