"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { getStoredTheme, setStoredTheme } from "@/lib/theme-store";
import { themes } from "@/lib/theme-config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, Monitor, Check } from "lucide-react";

export function ModeSwitcher() {
  const { theme: mode, setTheme: setMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const modeOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  if (!mounted) return null;

  const ActiveIcon = mode === "dark" ? Moon : mode === "system" ? Monitor : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ActiveIcon className="w-4 h-4" />
          <span className="sr-only">Toggle mode</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Mode
        </DropdownMenuLabel>
        {modeOptions.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <opt.icon className="w-4 h-4" />
              {opt.label}
            </span>
            {mode === opt.value && <Check className="w-3.5 h-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeSwitcher() {
  const [colorTheme, setColorTheme] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setColorTheme(getStoredTheme());
  }, []);

  const handleSetColorTheme = (id: string) => {
    setStoredTheme(id);
    setColorTheme(id);
  };

  if (!mounted) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <span
            className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"
            style={{
              background: `linear-gradient(135deg, ${
                themes.find((t) => t.id === colorTheme)?.colors.sidebar || "#fff"
              } 50%, ${
                themes.find((t) => t.id === colorTheme)?.colors.primary || "#000"
              } 50%)`,
            }}
          />
          <span className="sr-only">Switch theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => handleSetColorTheme(t.id)}
            className="flex items-center justify-between py-2"
          >
            <span className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-full border border-border shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${t.colors.sidebar} 50%, ${t.colors.primary} 50%)`,
                }}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </span>
            </span>
            {colorTheme === t.id && <Check className="w-4 h-4 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
