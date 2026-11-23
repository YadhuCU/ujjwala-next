"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { useSession } from "next-auth/react";
import LayoutLoader from "@/components/layout-loader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  if (status === "loading") {
    return <LayoutLoader />;
  }
  return (
    <SidebarProvider>
      <AppSidebar />
      {/* min-w-0: a wide table scrolls inside its card instead of stretching
          the whole page past the window. bg-page: the soft blue behind the
          white cards. */}
      <SidebarInset className="bg-page min-w-0">
        <Navbar />
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
