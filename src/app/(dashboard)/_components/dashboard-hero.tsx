import { PackageCheck, Receipt, Wallet } from "lucide-react";
import { CylinderImage } from "@/components/cylinder-image";

// The dashboard's opening panel. Copy only — every figure on the page comes
// from the dashboard query below it, never from here.
export function DashboardHero({ name }: { name?: string | null }) {
  return (
    <section className="border-border relative grid grid-cols-[minmax(0,1fr)_84px] items-center gap-4 overflow-hidden rounded-xl border bg-linear-to-br from-white from-35% to-[#e8f0f9] p-5 sm:grid-cols-[minmax(0,1fr)_128px] sm:p-6 dark:from-[#0f1e33] dark:to-[#12345a]">
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

      {/* The cylinder on a soft floor shadow */}
      <div className="relative h-[150px] self-center sm:h-[180px]">
        <span
          aria-hidden
          className="absolute inset-x-1 bottom-0 h-3.5 rounded-[50%] bg-[#cbd8e7] dark:bg-black/40"
        />
        <CylinderImage
          priority
          sizes="(min-width: 640px) 128px, 84px"
          className="relative h-full w-auto mx-auto drop-shadow-[0_12px_9px_rgb(20_42_68/0.13)]"
        />
      </div>
    </section>
  );
}
