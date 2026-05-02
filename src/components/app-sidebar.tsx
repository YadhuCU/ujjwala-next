"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Users,
  MapPin,
  BookOpen,
  Package,
  BarChart3,
  ShoppingCart,
  Home,
  Wallet,
  FileText,
  ChevronDown,
  Flame,
  Truck,
  ShoppingBag,
} from "lucide-react";

const mainNavItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, adminOnly: false },
  { title: "Users", href: "/users", icon: Users, adminOnly: true },
  { title: "Locations", href: "/locations", icon: MapPin, adminOnly: false },
  { title: "Customers", href: "/customers", icon: BookOpen, adminOnly: false },
  { title: "Products", href: "/products", icon: Package, adminOnly: false },
  { title: "Stock", href: "/stock", icon: BarChart3, adminOnly: false },
  { title: "Vendors", href: "/vendors", icon: Truck, adminOnly: true },
  { title: "Purchase", href: "/purchases", icon: ShoppingBag, adminOnly: true },
  { title: "Commercial Sale (Old)", href: "/sales", icon: ShoppingCart, adminOnly: false },
  { title: "Commercial Sale", href: "/commercial-sales", icon: ShoppingCart, adminOnly: false },
  { title: "Domestic Sale", href: "/dom-sales", icon: Home, adminOnly: false },
  { title: "ARB Sale", href: "/arb-sales", icon: ShoppingCart, adminOnly: false },
  { title: "Expense", href: "/expenses", icon: Wallet, adminOnly: false },
];

const reportItems = [
  { title: "Sale Report", href: "/reports/sales" },
  { title: "Expense Report", href: "/reports/expense" },
  { title: "Arb Sale Report", href: "/reports/arb-sale" },
  { title: "Purchase Report", href: "/reports/purchase" },
  { title: "Sale by Product Report", href: "/reports/sale-by-product" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isAdmin } = usePermissions();

  const filteredNavItems = mainNavItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-md">
            <Flame className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
            Ujjwala
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        item.href === "/"
                          ? pathname === "/"
                          : pathname.startsWith(item.href)
                      }
                      className="data-[active=true]:border-l-[3px] data-[active=true]:border-(--sidebar-active-border) data-[active=true]:rounded-none"
                    >
                      <Link href={item.href}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
              ))}

              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <FileText className="w-4 h-4" />
                      <span>Reports</span>
                      <ChevronDown className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {reportItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === item.href}
                          >
                            <Link href={item.href}>{item.title}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
