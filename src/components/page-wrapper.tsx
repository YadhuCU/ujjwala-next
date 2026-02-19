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
  description
}: PageWrapperProps) {
  const router = useRouter();

  return (
    <div className={twMerge("space-y-6", className)}>
      <div className="flex items-center gap-4">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
       <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {addButton}
      </div>
      {children}
    </div>
  );
}
