"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo, BrandName } from "@/components/brand-mark";
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
    <main className="bg-page flex min-h-svh justify-center p-0 sm:items-center sm:p-6">
      <div className="bg-card grid w-full max-w-5xl grid-rows-[auto_1fr] overflow-hidden max-sm:min-h-svh sm:rounded-2xl md:grid-rows-1 sm:border sm:shadow-[0_24px_60px_-30px_rgb(7_30_60/0.35)] md:grid-cols-2">
        {/* Brand panel: the sidebar's red under a white brand plate (the full
            logo, then the name), the three blue cylinders in the corner. On a
            phone the plate is a row, so it leaves room for the cylinders. */}
        <section className="bg-sidebar text-sidebar-foreground relative flex min-h-[320px] flex-col overflow-hidden p-6 sm:min-h-[360px] sm:p-8 md:min-h-[560px] md:p-10">
          <div className="bg-sidebar-header flex items-center gap-3 self-start rounded-xl p-3 shadow-[0_8px_24px_-12px_rgb(40_0_4/0.5)] md:flex-col md:items-start md:gap-3 md:p-4">
            <BrandLogo
              priority
              sizes="(min-width: 768px) 200px, 110px"
              className="h-[84px] w-[106px] p-1 md:h-[150px] md:w-[188px]"
            />
            <BrandName size="lg" className="pr-1" />
          </div>

          <h2 className="mt-8 max-w-[13ch] text-[27px] leading-[1.15] font-bold tracking-tight text-balance md:mt-10 md:text-[34px]">
            Good energy. Better business.
          </h2>
          <p className="text-sidebar-label mt-3 max-w-[30ch] text-[13px] max-md:max-w-[22ch]">
            One connected workspace for your agency&apos;s everyday operations.
          </p>

          {/* Reserved box, artwork contained: no cylinder ever leaves the frame.
              In the corner on a phone; below the copy from md up, where the
              taller brand plate would otherwise push the heading into it. */}
          <CylinderImage
            kind="group"
            priority
            sizes="(min-width: 768px) 200px, 150px"
            alt="Three blue commercial LPG cylinders"
            className="absolute right-4 bottom-4 h-[118px] w-[130px] drop-shadow-[0_14px_16px_rgb(40_0_4/0.45)] sm:h-[140px] sm:w-[154px] md:static md:mt-auto md:h-[180px] md:w-[198px] md:self-end md:pt-6"
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
