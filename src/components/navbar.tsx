"use client";

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
import { Input } from "@/components/ui/input";
import { LogOut, Settings, Search, Bell, Flame } from "lucide-react";
import { ModeSwitcher, ThemeSwitcher } from "@/components/theme-switcher";

export function Navbar() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";
  const role = session?.user?.role || "Role"
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-primary px-4 shrink-0 text-white">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 text-white hover:bg-white/10" />
        <div className="flex flex-col ml-1 leading-tight hidden lg:flex">
          <span className="text-sm font-bold">Ujjwala</span>
          <span className="text-[10px] opacity-70">Enterprise Analytics</span>
        </div>
      </div>

      <div className="flex-1 flex items-center ml-4">
        <div className="relative max-w-sm w-full hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
          <Input
            placeholder="Search data, reports, or inventory..."
            className="pl-9 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-offset-0 focus-visible:ring-white/30"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <ThemeSwitcher />
        <ModeSwitcher />

        <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border border-primary"></span>
        </Button>

        <Separator orientation="vertical" className="h-6 bg-white/20 mx-2" />

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-tight hidden sm:flex">
            <span className="text-sm font-semibold">{userName}</span>
            <span className="text-[10px] opacity-70">{role}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9 border border-white/20">
                  <AvatarFallback className="bg-white/10 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">
                  {session?.user?.email || ""}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 w-4 h-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 w-4 h-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
