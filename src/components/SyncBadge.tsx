"use client";

import { Cloud, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import * as vault from "@/lib/vault";
import { useT } from "@/locales";
import { useAuth } from "@/store/useAuth";

/** Small cloud icon in the top bar showing the sync state (cloud mode only). */
export function SyncBadge() {
  const t = useT();
  const mode = useAuth((s) => s.mode);
  const [status, setStatus] = useState<vault.SyncStatus>(vault.getSyncStatus());
  useEffect(() => vault.onSyncStatus(setStatus), []);
  if (mode !== "cloud") return null;
  const map = {
    idle: { Icon: Cloud, label: t("Bulutda saqlandi"), color: "var(--text-3)", spin: false },
    saved: { Icon: Cloud, label: t("Bulutda saqlandi"), color: "var(--green)", spin: false },
    saving: { Icon: Loader2, label: t("Saqlanmoqda…"), color: "var(--accent)", spin: true },
    offline: { Icon: CloudOff, label: t("Internet yo'q — keyin saqlanadi"), color: "var(--orange)", spin: false },
    error: { Icon: TriangleAlert, label: t("Saqlashda xatolik"), color: "var(--red)", spin: false },
  }[status];
  return (
    <span className="glass-chip grid size-9 place-items-center" title={map.label} aria-label={map.label} role="status">
      <map.Icon size={16} style={{ color: map.color }} className={map.spin ? "animate-spin" : undefined} />
    </span>
  );
}
