"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark";
/** Plain (unencrypted) key: appearance is not sensitive and the pre-paint script in layout.tsx reads it. */
export const THEME_KEY = "acq:theme";

export const GLASS_DEFAULT = { blur: 28, alpha: 0.42 };

interface ThemeState {
  theme: Theme;
  /** Backdrop blur in px. */
  glassBlur: number;
  /** Panel opacity 0.15–0.8 (strong panels are +0.2). */
  glassAlpha: number;
  setTheme: (t: Theme) => void;
  setGlass: (patch: Partial<{ glassBlur: number; glassAlpha: number }>) => void;
  resetGlass: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      glassBlur: GLASS_DEFAULT.blur,
      glassAlpha: GLASS_DEFAULT.alpha,
      setTheme: (theme) => set({ theme }),
      setGlass: (patch) => set(patch),
      resetGlass: () => set({ glassBlur: GLASS_DEFAULT.blur, glassAlpha: GLASS_DEFAULT.alpha }),
    }),
    { name: THEME_KEY, storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

/** Applies theme + glass settings to <html>. */
export function applyAppearance(s: Pick<ThemeState, "theme" | "glassBlur" | "glassAlpha">): void {
  const el = document.documentElement;
  el.classList.toggle("dark", s.theme === "dark");
  el.style.setProperty("--glass-blur", `${s.glassBlur}px`);
  el.style.setProperty("--ga", String(s.glassAlpha));
  el.style.setProperty("--gas", String(Math.min(0.95, s.glassAlpha + 0.2)));
}
