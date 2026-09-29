"use client";

import { twMerge } from "tailwind-merge";
import { Button } from "./ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type PageWrapperProps = {
  className?: string;
  children: React.ReactNode;
  title?: string;
  description?: string;
  showBackButton?: boolean;
  addButton?: React.ReactNode;
};

export function PageWrapper({
  className,
  children,
  title,
  showBackButton = false,
  addButton,
  description,
}: PageWrapperProps) {
  const router = useRouter();

  return (
    <div className={twMerge("space-y-4 sm:space-y-6", className)}>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 shrink-0"
            aria-label="Go back"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-balance sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {/* On a phone the page's main action takes its own full-width row,
            where a thumb can reach it, instead of squeezing the title. */}
        {addButton && (
          <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
            {addButton}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
