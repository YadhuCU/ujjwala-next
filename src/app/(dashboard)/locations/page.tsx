"use client";

import { usePermission } from "@/hooks/use-permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { LocationViewComponent } from "./components/location-view";
import { PERMISSIONS } from "@/lib/permissions";

export default function LocationsPage() {
  const { hasPermission } = usePermission();
  const createLocationPermission = hasPermission(PERMISSIONS.LOCATION_CREATE);

  return (
    <PageWrapper
      title="Locations"
      showBackButton
      addButton={
        createLocationPermission && (
          <Button asChild className="ml-auto">
            <Link href="/locations/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Link>
          </Button>
        )
      }
    >
      <LocationViewComponent />
    </PageWrapper>
  );
}
