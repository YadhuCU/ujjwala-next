"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { CylinderImage } from "@/components/cylinder-image";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid username or password");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="bg-background flex min-h-svh justify-center p-0 sm:items-center sm:p-6">
      <div className="bg-card grid w-full max-w-5xl grid-rows-[auto_1fr] overflow-hidden max-sm:min-h-svh sm:rounded-2xl md:grid-rows-1 sm:border sm:shadow-[0_24px_60px_-30px_rgb(7_30_60/0.35)] md:grid-cols-2">
        {/* Brand panel: navy into HP blue, the cylinder standing in the corner */}
        <section className="relative flex min-h-[300px] flex-col overflow-hidden bg-linear-to-br from-[#071e3c] to-[#004e8f] p-6 text-white sm:min-h-[340px] sm:p-8 md:min-h-[560px] md:p-10">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-xl font-bold tracking-tight">Ujjwala</p>
              <p className="text-[10px] font-medium tracking-[0.14em] text-[#a9bfd7] uppercase">
                Agency ERP
              </p>
            </div>
          </div>

          <h2 className="mt-8 max-w-[13ch] text-[27px] leading-[1.15] font-bold tracking-tight text-balance md:mt-10 md:text-[34px]">
            Good energy. Better business.
          </h2>
          <p className="mt-3 max-w-[30ch] text-[13px] text-[#c8ddf0] max-md:max-w-[22ch]">
            One connected workspace for your agency&apos;s everyday operations.
          </p>

          <CylinderImage
            priority
            sizes="(min-width: 768px) 170px, 110px"
            alt="A domestic LPG cylinder"
            className="absolute right-5 bottom-5 w-[96px] drop-shadow-[0_14px_16px_rgb(0_19_38/0.45)] sm:w-[118px] md:right-12 md:bottom-10 md:w-[170px]"
          />
        </section>

        <section className="flex flex-col p-6 sm:justify-center sm:p-10">
          <p className="text-primary text-[11px] font-bold tracking-[0.16em] uppercase">
            Your agency workspace
          </p>
          <h1 className="mt-2 text-[27px] font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sign in to start your day.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 grid gap-5">
            {error && (
              <div
                role="alert"
                className="bg-destructive/10 border-destructive/25 text-destructive rounded-md border px-4 py-3 text-sm"
              >
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Your username"
                required
                className="h-11 md:h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                required
                className="h-11 md:h-11"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full md:h-11">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
