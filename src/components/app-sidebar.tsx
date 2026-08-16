"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermission } from "@/hooks/use-permissions";
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
  SlidersHorizontal,
  type LucideIcon,
  Warehouse,
  ShieldCheck,
  FileBarChart,
} from "lucide-react";
import { Permission, PERMISSIONS } from "@/lib/permissions";

type NavItem = {
  title: string;
  href: string;
  requiredPermissions?: Permission[];
  icon?: LucideIcon;
  sub?: NavItem[];
};

const sidebarMenu: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    requiredPermissions: [PERMISSIONS.DASHBOARD_READ],
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
    requiredPermissions: [PERMISSIONS.USER_READ],
  },
  {
    title: "Roles & Permissions",
    href: "/roles",
    icon: ShieldCheck,
    requiredPermissions: [PERMISSIONS.ROLE_READ],
  },
  {
    title: "Locations",
    href: "/locations",
    icon: MapPin,
    requiredPermissions: [PERMISSIONS.LOCATION_READ],
  },
  {
    title: "Customers",
    href: "/customers",
    icon: BookOpen,
    requiredPermissions: [PERMISSIONS.CUSTOMER_READ],
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
    requiredPermissions: [PERMISSIONS.PRODUCT_READ],
  },
  {
    title: "Stock",
    href: "/stock",
    icon: BarChart3,
    requiredPermissions: [PERMISSIONS.STOCK_READ],
  },
  {
    title: "Godown",
    href: "/godown",
    icon: Warehouse,
    requiredPermissions: [PERMISSIONS.STOCK_READ],
  },
  {
    title: "Stock Adjustment",
    href: "/stock-adjustments",
    icon: SlidersHorizontal,
    requiredPermissions: [PERMISSIONS.STOCK_READ],
  },
  {
    title: "Vendors",
    href: "/vendors",
    icon: Truck,
    requiredPermissions: [PERMISSIONS.VENDOR_READ],
  },
  {
    title: "Purchase",
    href: "/purchases",
    icon: ShoppingBag,
    requiredPermissions: [PERMISSIONS.PURCHASE_READ],
  },
  {
    title: "Commercial Sale",
    href: "/commercial-sales",
    icon: ShoppingCart,
    requiredPermissions: [PERMISSIONS.COMMERCIAL_SALE_READ],
  },
  {
    title: "Domestic Sale",
    href: "/dom-sales",
    icon: Home,
    requiredPermissions: [PERMISSIONS.DOMESTIC_SALE_READ],
  },
  {
    title: "ARB Sale",
    href: "/arb-sales",
    icon: ShoppingCart,
    requiredPermissions: [PERMISSIONS.ARB_SALE_READ],
  },
  {
    title: "Expense",
    href: "/expenses",
    icon: Wallet,
    requiredPermissions: [PERMISSIONS.EXPENSE_READ],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileBarChart,
    requiredPermissions: [PERMISSIONS.REPORT_READ],
    sub: [
      {
        title: "Commercial Sale Report",
        href: "/reports/commercial-sale",
        requiredPermissions: [PERMISSIONS.REPORT_READ],
      },
      {
        title: "Domestic Sale Report",
        href: "/reports/dom-sale",
        requiredPermissions: [PERMISSIONS.REPORT_READ],
      },
      {
        title: "Arb Sale Report",
        href: "/reports/arb-sale",
        requiredPermissions: [PERMISSIONS.REPORT_READ],
      },
      {
        title: "Sale by Product Report",
        href: "/reports/sale-by-product",
        requiredPermissions: [PERMISSIONS.REPORT_READ],
      },
      {
        title: "Expense Report",
        href: "/reports/expense",
        requiredPermissions: [PERMISSIONS.REPORT_READ],
      },
      {
        title: "Purchase Report",
        href: "/reports/purchase",
        requiredPermissions: [PERMISSIONS.REPORT_READ],
      },
    ],
  },
];

export function AppSidebar() {
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
              {sidebarMenu.map((item) => {
                if (item.sub && item.sub.length > 0) {
                  return <SubNavbarItemComponent {...item} key={item.href} />;
                }
                return <NavbarItemComponent {...item} key={item.href} />;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

type NavbarItemComponentProps = Omit<NavItem, "sub">;

function NavbarItemComponent({
  href,
  title,
  requiredPermissions,
  ...props
}: NavbarItemComponentProps) {
  const { hasAnyPermission } = usePermission();

  const pathname = usePathname();
  const hasPermission = hasAnyPermission(requiredPermissions ?? []);

  if (requiredPermissions && requiredPermissions.length > 0 && !hasPermission) {
    return null;
  }

  // Sub-links carry no icon
  const Icon = props.icon;

  return (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton
        asChild
        isActive={href === "/" ? pathname === "/" : pathname.startsWith(href)}
        className="data-[active=true]:border-l-[3px] data-[active=true]:border-(--sidebar-active-border) data-[active=true]:rounded-none"
      >
        <Link href={href}>
          {Icon && <Icon className="w-4 h-4" />}
          <span>{title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

type SubNavbarItemComponentProps = NavItem;

function SubNavbarItemComponent({
  title,
  requiredPermissions,
  sub,
}: SubNavbarItemComponentProps) {
  const { hasAnyPermission } = usePermission();

  const pathname = usePathname();
  const hasPermission = hasAnyPermission(requiredPermissions ?? []);

  if (requiredPermissions && requiredPermissions.length > 0 && !hasPermission) {
    return null;
  }

  if (!sub || sub.length === 0) {
    return null;
  }

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <FileText className="w-4 h-4" />
            <span>{title}</span>
            <ChevronDown className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {sub.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                  <Link href={item.href}>{item.title}</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
