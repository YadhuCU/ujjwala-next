"use client";

import { CylinderImage } from "@/components/cylinder-image";

// Shown while the session loads. The cylinder settles and a red sweep runs
// beneath it; both stop for anyone who has asked for reduced motion.
const LayoutLoader = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-background flex h-screen flex-col items-center justify-center gap-5"
    >
      <div className="w-16 motion-safe:animate-[cylinder-bob_1.6s_ease-in-out_infinite]">
        <CylinderImage
          kind="single"
          priority
          sizes="64px"
          className="drop-shadow-[0_10px_8px_rgb(20_42_68/0.18)]"
        />
      </div>
      <div className="bg-border relative h-1 w-40 overflow-hidden rounded-full">
        <div className="bg-signal absolute inset-y-0 left-0 w-1/3 rounded-full motion-safe:animate-[loader-sweep_1.2s_ease-in-out_infinite]" />
      </div>
      <p className="text-muted-foreground text-sm">Loading Ujjwala…</p>
    </div>
  );
};

export default LayoutLoader;
