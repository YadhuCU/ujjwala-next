"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Settings, Bell } from "lucide-react";
import { ModeSwitcher } from "@/components/mode-switcher";
import { navTrail } from "@/components/app-sidebar";

// White, with HP red as a thin rule along the top — the one place red frames
// the page. The breadcrumb comes from the sidebar's own sections, so the two
// always name a page the same way.
export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const trail = navTrail(pathname);
  const userName = session?.user?.name || "User";
  const roles = session?.user.roles || [];
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="bg-card border-signal sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-t-[3px] border-b px-4 sm:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1" />

      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground min-w-0 truncate text-[13px]"
      >
        {trail.length === 0 ? (
          <span className="text-foreground font-medium">Ujjwala</span>
        ) : (
          trail.map((part, index) => (
            <Fragment key={part}>
              {index > 0 && (
                <span className="mx-1.5 opacity-60 max-sm:hidden">/</span>
              )}
              <span
                className={
                  index === trail.length - 1
                    ? "text-foreground font-medium"
                    : // Phones show only where they are, not the whole path
                      "max-sm:hidden"
                }
              >
                {part}
              </span>
            </Fragment>
          ))
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <ModeSwitcher />

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground relative"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="bg-signal border-card absolute top-2 right-2 h-2 w-2 rounded-full border" />
        </Button>

        <Separator orientation="vertical" className="mx-2 h-6" />

        <div className="flex items-center gap-3">
          <div className="hidden flex-col items-end leading-tight sm:flex">
            <span className="text-[13px] font-semibold">{userName}</span>
            {roles.length > 0 && (
              <span className="text-muted-foreground max-w-48 truncate text-[11px]">
                {roles.join(", ")}
              </span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full p-0"
                aria-label="Account menu"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-muted-foreground text-xs">
                  {session?.user?.email || roles.join(", ")}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
