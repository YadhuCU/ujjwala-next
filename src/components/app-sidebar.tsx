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
  useSidebar,
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
  Truck,
  ShoppingBag,
  SlidersHorizontal,
  type LucideIcon,
  Warehouse,
  ShieldCheck,
  FileBarChart,
} from "lucide-react";
import { Permission, PERMISSIONS } from "@/lib/permissions";
import { APP_NAME, BrandLockup } from "@/components/brand-mark";

type NavItem = {
  title: string;
  href: string;
  requiredPermissions?: Permission[];
  icon?: LucideIcon;
  sub?: NavItem[];
};

type NavSection = { label: string; items: NavItem[] };

// Grouped the way the agency works: selling, the cylinders behind it, who it
// deals with, the money, and the people who run the app. Every route and
// permission is unchanged — this is only where each link sits.
export const navSections: NavSection[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        requiredPermissions: [PERMISSIONS.DASHBOARD_READ],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        title: "Domestic Sale",
        href: "/dom-sales",
        icon: Home,
        requiredPermissions: [PERMISSIONS.DOMESTIC_SALE_READ],
      },
      {
        title: "Commercial Sale",
        href: "/commercial-sales",
        icon: ShoppingCart,
        requiredPermissions: [PERMISSIONS.COMMERCIAL_SALE_READ],
      },
      {
        title: "ARB Sale",
        href: "/arb-sales",
        icon: ShoppingCart,
        requiredPermissions: [PERMISSIONS.ARB_SALE_READ],
      },
    ],
  },
  {
    label: "Inventory",
    items: [
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
        title: "Purchase",
        href: "/purchases",
        icon: ShoppingBag,
        requiredPermissions: [PERMISSIONS.PURCHASE_READ],
      },
      {
        title: "Products",
        href: "/products",
        icon: Package,
        requiredPermissions: [PERMISSIONS.PRODUCT_READ],
      },
    ],
  },
  {
    label: "Directory",
    items: [
      {
        title: "Customers",
        href: "/customers",
        icon: BookOpen,
        requiredPermissions: [PERMISSIONS.CUSTOMER_READ],
      },
      {
        title: "Vendors",
        href: "/vendors",
        icon: Truck,
        requiredPermissions: [PERMISSIONS.VENDOR_READ],
      },
      {
        title: "Locations",
        href: "/locations",
        icon: MapPin,
        requiredPermissions: [PERMISSIONS.LOCATION_READ],
      },
    ],
  },
  {
    label: "Finance",
    items: [
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
          // Agency-wide, so each has a permission of its own
          {
            title: "Product Wise Report",
            href: "/reports/product-wise",
            requiredPermissions: [PERMISSIONS.REPORT_PRODUCT_WISE],
          },
          {
            title: "Customer Wise Report",
            href: "/reports/customer-wise",
            requiredPermissions: [PERMISSIONS.REPORT_CUSTOMER_WISE],
          },
          {
            title: "Profit Report",
            href: "/reports/profit",
            requiredPermissions: [PERMISSIONS.REPORT_PROFIT],
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
    ],
  },
  {
    label: "Administration",
    items: [
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
    ],
  },
];

// On a phone the sidebar is a sheet over the page. Navigating does not unmount
// the layout, so without this the sheet stays open on top of the page the user
// just asked for.
function useCloseOnNavigate() {
  const { isMobile, setOpenMobile } = useSidebar();
  return () => {
    if (isMobile) setOpenMobile(false);
  };
}

export function AppSidebar() {
  const closeOnNavigate = useCloseOnNavigate();
  const { hasAnyPermission } = usePermission();

  // A section whose every link is hidden would leave a bare label behind
  const canSee = (item: NavItem): boolean =>
    (!item.requiredPermissions?.length ||
      hasAnyPermission(item.requiredPermissions)) &&
    (!item.sub?.length || item.sub.some(canSee));

  return (
    <Sidebar className="border-r border-sidebar-border">
      {/* White brand header: the HP Gas emblem and the red wordmark need a
          white ground, so they sit above the red navigation, not on it */}
      <SidebarHeader className="bg-sidebar-header border-sidebar-header-border border-b px-4 py-4">
        <Link
          href="/"
          aria-label={`${APP_NAME} — dashboard`}
          className="focus-visible:ring-ring rounded-md outline-hidden focus-visible:ring-2"
          onClick={closeOnNavigate}
        >
          <BrandLockup priority />
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0 px-1 pt-2">
        {navSections.map((section) => {
          const items = section.items.filter(canSee);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={section.label} className="py-1">
              <SidebarGroupLabel className="text-sidebar-label h-7 text-[10px] font-semibold tracking-[0.14em] uppercase">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) =>
                    item.sub && item.sub.length > 0 ? (
                      <SubNavbarItemComponent {...item} key={item.href} />
                    ) : (
                      <NavbarItemComponent {...item} key={item.href} />
                    ),
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

/**
 * Where the user is, as the header's breadcrumb: the section, then the link,
 * then the report under it. Child pages (/stock/add) resolve to their section.
 */
export function navTrail(pathname: string): string[] {
  for (const section of navSections) {
    for (const item of section.items) {
      const sub = item.sub?.find((child) => isRouteActive(pathname, child.href));
      if (sub) return [section.label, item.title, sub.title];
      if (isRouteActive(pathname, item.href)) return [section.label, item.title];
    }
  }
  return [];
}

// Active: the darkest red, with a white marker down its left edge. It keeps
// that colour under the pointer rather than flashing to the hover shade.
const ACTIVE_ITEM =
  "max-md:h-10 h-9 px-3 text-[13px] data-[active=true]:bg-sidebar-primary data-[active=true]:hover:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-[inset_3px_0_0_var(--sidebar-active-border)]";

/**
 * Is this link the section the user is currently in?
 *
 * A plain `pathname.startsWith(href)` matches sibling routes that merely share
 * a prefix — being on /stock-adjustments lit up both "Stock" and "Stock
 * Adjustment". Requiring the next character to be a separator fixes that while
 * still keeping a section highlighted on its own child pages (/stock/add).
 */
export function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavbarItemComponentProps = Omit<NavItem, "sub">;

function NavbarItemComponent({
  href,
  title,
  requiredPermissions,
  ...props
}: NavbarItemComponentProps) {
  const { hasAnyPermission } = usePermission();
  const closeOnNavigate = useCloseOnNavigate();

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
        isActive={isRouteActive(pathname, href)}
        className={ACTIVE_ITEM}
      >
        <Link href={href} onClick={closeOnNavigate}>
          {Icon && <Icon className="w-4 h-4" />}
          <span>{title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

type SubNavbarItemComponentProps = NavItem;

function SubNavbarItemComponent({
  href,
  title,
  requiredPermissions,
  sub,
  ...props
}: SubNavbarItemComponentProps) {
  const { hasAnyPermission } = usePermission();
  const closeOnNavigate = useCloseOnNavigate();

  const pathname = usePathname();
  const hasPermission = hasAnyPermission(requiredPermissions ?? []);

  if (requiredPermissions && requiredPermissions.length > 0 && !hasPermission) {
    return null;
  }

  // Children carry their own permissions; a group whose children are all
  // hidden should not render an empty expander.
  const visible = (sub ?? []).filter(
    (item) =>
      !item.requiredPermissions ||
      item.requiredPermissions.length === 0 ||
      hasAnyPermission(item.requiredPermissions),
  );

  if (visible.length === 0) {
    return null;
  }

  const Icon = props.icon ?? FileText;

  // The group itself is a real route (/reports), so it can be the active item;
  // and being anywhere inside the section should both highlight it and leave
  // the group open rather than collapsing under the user.
  const onIndex = pathname === href;
  const inSection =
    isRouteActive(pathname, href) ||
    visible.some((item) => isRouteActive(pathname, item.href));

  return (
    <Collapsible defaultOpen={inSection} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={onIndex}
            className={ACTIVE_ITEM}
          >
            <Icon className="w-4 h-4" />
            <span>{title}</span>
            <ChevronDown className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {visible.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={isRouteActive(pathname, item.href)}
                  className="text-sidebar-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:hover:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium max-md:h-9 h-8 text-[13px]"
                >
                  <Link href={item.href} onClick={closeOnNavigate}>
                    {item.title}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
