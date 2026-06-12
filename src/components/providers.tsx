"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import {
  QueryClient,
  QueryClientProvider,
  QueryErrorResetBoundary,
} from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { initTheme } from "@/lib/theme-store";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { ErrorListToast } from "./ui/sonner";

function handleGlobalMutationError(error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data;

    if (
      data?.data &&
      typeof data.data === "object" &&
      !Array.isArray(data.data)
    ) {
      const errors = data.data as Record<string, string | number>;

      toast.error(data?.message ?? data?.error ?? "Error", {
        description: <ErrorListToast errors={errors} />,
      });

      return;
    }

    if (
      data?.data &&
      typeof data.data === "string" &&
      data?.message &&
      typeof data?.message === "string"
    ) {
      toast.error(data?.message, {
        description: data.data,
      });
      return;
    }

    if (
      data?.detail &&
      typeof data.detail === "string" &&
      data?.message &&
      typeof data?.message === "string"
    ) {
      toast.error(data?.message, {
        description: data.detail,
      });
      return;
    }

    if (
      data?.detail &&
      typeof data.detail === "string" &&
      data?.error &&
      typeof data?.error === "string"
    ) {
      toast.error(data?.error, {
        description: data.detail,
      });
      return;
    }

    if (data?.data && typeof data.data === "string") {
      toast.error("Error", {
        description: data.data,
      });
      return;
    }

    if (
      data?.errors &&
      typeof data.errors === "object" &&
      !Array.isArray(data.errors)
    ) {
      const errors = data.errors as Record<string, string | number>;

      toast.error(data?.message ?? data?.error ?? "Error", {
        description: <ErrorListToast errors={errors} />,
      });

      return;
    }

    toast.error("Error", {
      description:
        data?.error ?? data?.errors ?? data?.message ?? error.message,
    });
    return;
  }

  if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error(String(error ?? "Unknown error"));
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
          mutations: {
            onError: (error) => handleGlobalMutationError(error),
          },
        },
      }),
  );

  useEffect(() => {
    initTheme();
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        <QueryErrorResetBoundary>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </QueryErrorResetBoundary>
      </SessionProvider>
    </ThemeProvider>
  );
}
