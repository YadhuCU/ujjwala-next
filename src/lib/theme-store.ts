"use client";

import { DEFAULT_THEME } from "./theme-config";

const STORAGE_KEY = "app-theme";

export function getStoredTheme(): string {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
}

export function setStoredTheme(theme: string) {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function initTheme() {
  const stored = getStoredTheme();
  document.documentElement.setAttribute("data-theme", stored);
  return stored;
}
