"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
