import Image from "next/image";
import { cn } from "@/lib/utils";

/** The application's full name, wherever it is written out in one piece. */
export const APP_NAME = "Ujjwala HP gas agency ERP";

/**
 * The full HP Gas logo: the mascot, the Hindi lettering, the divider, the HP
 * GAS emblem and "your friendly gas". An AI-assisted restoration of the
 * low-resolution original, on a transparent ground — its navy lettering needs
 * white behind it, so it always sits on a white plate, in dark mode too.
 * Contained in whatever box the caller gives it (set a height and width);
 * never cropped or stretched.
 *
 * Too detailed below ~80px tall. The favicon uses the emblem alone.
 */
export function BrandLogo({
  className,
  sizes = "200px",
  priority = false,
}: {
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1.5",
        className,
      )}
    >
      <Image
        src="/brand/hp-gas-full-logo.webp"
        width={800}
        height={638}
        alt="HP Gas — your friendly gas"
        sizes={sizes}
        priority={priority}
        className="h-full w-full min-h-0 min-w-0 object-contain select-none"
        draggable={false}
      />
    </span>
  );
}

/** "Ujjwala" in HP red over "HP gas agency ERP" — text, not artwork. */
export function BrandName({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <span className={cn("flex min-w-0 flex-col leading-tight", className)}>
      <span
        className={cn(
          "text-wordmark font-bold tracking-[-0.03em]",
          size === "lg" ? "text-[26px]" : "text-[22px]",
        )}
      >
        Ujjwala
      </span>
      <span
        className={cn(
          "text-wordmark-caption mt-0.5",
          size === "lg" ? "text-[13px]" : "text-[12px]",
        )}
      >
        HP gas agency ERP
      </span>
    </span>
  );
}

/**
 * The sidebar's brand block: the full logo on its own row, the name beneath.
 * Designed for a white ground; in dark mode the caller's surface turns dark,
 * the logo keeps its white plate and the wordmark lightens.
 */
export function BrandLockup({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("flex flex-col gap-3", className)}>
      <BrandLogo priority={priority} sizes="220px" className="h-[116px] w-full" />
      <BrandName />
    </span>
  );
}
