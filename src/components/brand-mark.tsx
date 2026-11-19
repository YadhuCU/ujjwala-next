import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/** The red flame tile beside the name — the app's mark, sidebar and sign-in. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-signal grid size-9 shrink-0 place-items-center rounded-[10px_10px_10px_3px] text-white shadow-sm",
        className,
      )}
    >
      <Flame className="size-5" />
    </span>
  );
}
