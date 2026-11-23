import Image from "next/image";
import { cn } from "@/lib/utils";

// public/brand — outside the auth proxy (see `src/proxy.ts`), so the sign-in
// page can show them before there is a session
const SOURCES = {
  single: { src: "/brand/blue-cylinder-single.webp", width: 240, height: 360 },
  group: { src: "/brand/blue-cylinder-group.webp", width: 788, height: 720 },
} as const;

/**
 * The blue commercial LPG cylinder artwork.
 *
 * - `single` — one cylinder: stock tiles, the loading screen. `empty` shows it
 *   in grey, for empty stock. The group must never stand in for a count.
 * - `group` — three cylinders: the dashboard hero and the sign-in panel only.
 *
 * The box is set by `className` (give it a width and/or height); the artwork is
 * contained inside it, so it never distorts or crops.
 */
export function CylinderImage({
  kind = "single",
  empty = false,
  className,
  alt = "",
  sizes = "160px",
  priority = false,
}: {
  kind?: keyof typeof SOURCES;
  /** Empty stock: the same cylinder, greyed */
  empty?: boolean;
  className?: string;
  /** Leave empty where it is decoration beside text that says the same. */
  alt?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      {...SOURCES[kind]}
      alt={alt}
      sizes={sizes}
      priority={priority}
      className={cn(
        "h-auto w-full object-contain select-none",
        // Grey on a white card; lifted on a dark one, where plain grayscale
        // of a navy cylinder all but disappears
        empty && "opacity-70 grayscale dark:opacity-90 dark:brightness-[1.9]",
        className,
      )}
      draggable={false}
    />
  );
}
