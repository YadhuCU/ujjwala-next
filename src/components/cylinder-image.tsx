import Image from "next/image";
import cylinder from "@/assets/images/lpg-cylinder.webp";
import { cn } from "@/lib/utils";

/**
 * The domestic LPG cylinder photograph used across the app: sign-in, the
 * dashboard and the loading screen. A static import, so Next serves it from
 * /_next/static (outside the auth proxy) and resizes it per `sizes`.
 *
 * The box is set by `className` (give it a width or height); the photo is
 * contained inside it, so it never distorts.
 */
export function CylinderImage({
  className,
  alt = "",
  sizes = "160px",
  priority = false,
}: {
  className?: string;
  /** Leave empty where it is decoration beside text that says the same. */
  alt?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={cylinder}
      alt={alt}
      sizes={sizes}
      priority={priority}
      placeholder="empty"
      className={cn("h-auto w-full object-contain select-none", className)}
      draggable={false}
    />
  );
}
