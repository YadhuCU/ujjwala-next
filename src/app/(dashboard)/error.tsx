"use client";

import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const { reset: resetQuery } = useQueryErrorResetBoundary();

  const handleRetry = () => {
    resetQuery();
    reset();
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-lg">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>

        {/* Title */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Something went wrong
          </h1>

          <p className="text-sm text-muted-foreground">
            We couldn&apos;t complete your request. You can retry or return to
            the previous page.
          </p>
        </div>

        {/* Optional dev error details */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Error details
            </p>
            <pre className="overflow-auto text-xs break-words">
              {error.message}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>

          <Button className="flex-1" onClick={handleRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
