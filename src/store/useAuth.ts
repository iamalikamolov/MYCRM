"use client";

import { create } from "zustand";
import * as vault from "@/lib/vault";

export type AuthStatus = "loading" | "setup" | "locked" | "unlocked";

interface AuthState {
  status: AuthStatus;
  mode: vault.Mode;
  autoLockMin: number;
  init: () => Promise<void>;
  setup: (password: string, setupCode?: string) => Promise<void>;
  /** true = correct; false = wrong password. Throws VaultError on rate limit / network. */
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  setAutoLockMin: (min: number) => void;
  wipe: (setupCode?: string) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  mode: "local",
  autoLockMin: 15,
  init: async () => {
    if (vault.isUnlocked()) return set({ status: "unlocked", mode: vault.getMode(), autoLockMin: vault.getAutoLockMin() });
    const r = await vault.initVault();
    set({ status: r.hasPassword ? "locked" : "setup", mode: r.mode, autoLockMin: vault.getAutoLockMin() });
  },
  setup: async (password, setupCode) => {
    await vault.setupPassword(password, setupCode);
    set({ status: "unlocked", autoLockMin: vault.getAutoLockMin() });
  },
  unlock: async (password) => {
    const ok = await vault.unlock(password);
    if (ok) set({ status: "unlocked", autoLockMin: vault.getAutoLockMin() });
    return ok;
  },
  lock: () => {
    vault.lock();
    set({ status: "locked" });
  },
  setAutoLockMin: (min) => {
    vault.setAutoLockMin(min);
    set({ autoLockMin: min });
  },
  wipe: async (setupCode) => {
    await vault.wipeEverything(setupCode);
    set({ status: "setup" });
  },
}));
