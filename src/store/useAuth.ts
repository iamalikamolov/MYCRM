"use client";

import { create } from "zustand";
import * as vault from "@/lib/vault";

export type AuthStatus = "loading" | "setup" | "locked" | "unlocked";

interface AuthState {
  status: AuthStatus;
  autoLockMin: number;
  init: () => void;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  setAutoLockMin: (min: number) => void;
  wipe: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  autoLockMin: 15,
  init: () => {
    if (vault.isUnlocked()) return set({ status: "unlocked", autoLockMin: vault.getAutoLockMin() });
    set({ status: vault.hasPassword() ? "locked" : "setup", autoLockMin: vault.getAutoLockMin() });
  },
  setup: async (password) => {
    await vault.setupPassword(password);
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
  wipe: () => {
    vault.wipeEverything();
    set({ status: "setup" });
  },
}));
