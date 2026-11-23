import { PackageCheck, Receipt, Wallet } from "lucide-react";
import { CylinderImage } from "@/components/cylinder-image";

// The dashboard's opening panel. Copy only — every figure on the page comes
// from the dashboard query below it, never from here.
export function DashboardHero({ name }: { name?: string | null }) {
  return (
    <section className="border-hero-border bg-hero shadow-card relative grid grid-cols-1 items-center gap-4 overflow-hidden rounded-xl border p-5 sm:grid-cols-[minmax(0,1fr)_155px] sm:p-6 lg:grid-cols-[minmax(0,1fr)_239px]">
      <div className="min-w-0">
        <p className="text-primary text-[10px] font-bold tracking-[0.16em] uppercase sm:text-[11px]">
          {name ? `Welcome back, ${name}` : "Energy for everyday life"}
        </p>
        <h2 className="mt-2 text-xl leading-[1.18] font-bold tracking-tight text-balance text-[#071e3c] sm:text-[28px] dark:text-white">
          Every cylinder counts. Every detail, connected.
        </h2>
        <p className="text-muted-foreground mt-2 max-w-[42ch] text-[13px] max-sm:hidden">
          A clearer view of the business that keeps your community moving.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#355674] dark:text-[#a9c3dd]">
          {[
            { label: "Inventory", icon: PackageCheck },
            { label: "Sales", icon: Receipt },
            { label: "Collections", icon: Wallet },
          ].map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-1.5">
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Three blue cylinders in a reserved box, contained so none is clipped;
          on a phone they stand below the copy */}
      <div className="relative mx-auto h-[170px] w-full max-w-[240px] sm:h-[150px] sm:max-w-none lg:h-[185px]">
        <CylinderImage
          kind="group"
          priority
          alt="Three blue commercial LPG cylinders"
          sizes="(min-width: 1024px) 239px, (min-width: 640px) 155px, 240px"
          className="h-full w-full drop-shadow-[0_9px_8px_rgb(18_51_82/0.1)]"
        />
      </div>
    </section>
  );
}
