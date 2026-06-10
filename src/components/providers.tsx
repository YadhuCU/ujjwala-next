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

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
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
