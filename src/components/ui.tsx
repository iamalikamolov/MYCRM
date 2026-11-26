"use client";

import { Check, Minus, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { create } from "zustand";
import { useMounted } from "./motion";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ─── Card ────────────────────────────────────────────────────────────────────
export function GlassCard({
  id,
  icon: Icon,
  iconTone = "var(--accent)",
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  className,
  delay = 0,
}: {
  id?: string;
  icon?: LucideIcon;
  iconTone?: string;
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section id={id} className={cn("glass fade-in scroll-mt-28 p-5 sm:p-6", className)} style={{ animationDelay: `${delay}ms` }}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span
              className="grid size-10 flex-none place-items-center rounded-2xl"
              style={{
                color: iconTone,
                background: `color-mix(in srgb, ${iconTone} 14%, transparent)`,
                boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.35), 0 6px 16px -8px ${iconTone}`,
              }}
            >
              <Icon size={19} strokeWidth={2.1} />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <div className="label mb-0.5">{eyebrow}</div>}
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
            {subtitle && <p className="text-2 mt-0.5 text-[13px]">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

// ─── Progress ────────────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  from,
  to,
  className,
  label,
}: {
  value: number;
  from?: string;
  to?: string;
  className?: string;
  label?: string;
}) {
  const mounted = useMounted();
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("progress-track", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
    >
      <div className="progress-fill" style={{ width: `${mounted ? v : 0}%`, "--from": from, "--to": to } as CSSProperties} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 168,
  stroke = 14,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mounted = useMounted();
  const v = mounted ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring-glow -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

// ─── Inputs ──────────────────────────────────────────────────────────────────
export function CheckButton({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange} className="check" data-checked={checked}>
      {checked && <Check size={13} strokeWidth={3.2} />}
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)));
  return (
    <div className="flex items-center gap-1 rounded-full border p-1" style={{ background: "var(--field-bg)", borderColor: "var(--field-border)" }}>
      <button type="button" className="icon-btn size-7" aria-label={`${label} −1`} onClick={() => set(value - 1)}>
        <Minus size={14} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        className="tabular w-12 bg-transparent text-center text-[15px] font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={value}
        min={min}
        max={max}
        onChange={(e) => set(parseInt(e.target.value || "0", 10))}
      />
      <button type="button" className="icon-btn size-7" aria-label={`${label} +1`} onClick={() => set(value + 1)}>
        <Plus size={14} />
      </button>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  small = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  small?: boolean;
}) {
  const w = small ? 34 : 44;
  const k = small ? 18 : 22;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      title={label}
      className="relative flex-none rounded-full transition-colors duration-200"
      style={{ width: w, height: k + 4, background: checked ? "var(--green)" : "var(--track)" }}
    >
      <span
        className="absolute top-[2px] left-0 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition-transform duration-200"
        style={{ width: k, height: k, transform: `translateX(${checked ? w - k - 2 : 2}px)` }}
      />
    </button>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
interface ToastState {
  message: string | null;
  key: number;
  show: (m: string) => void;
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const useToast = create<ToastState>((set) => ({
  message: null,
  key: 0,
  show: (message) => {
    clearTimeout(toastTimer);
    set((s) => ({ message, key: s.key + 1 }));
    toastTimer = setTimeout(() => set({ message: null }), 2400);
  },
}));
export const toast = (m: string) => useToast.getState().show(m);

export function Toaster() {
  const { message, key } = useToast();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
      {message && (
        <div key={key} className="glass-chip toast-in flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold">
          <span className="grid size-5 place-items-center rounded-full text-white" style={{ background: "var(--green)" }}>
            <Check size={12} strokeWidth={3} />
          </span>
          {message}
        </div>
      )}
    </div>
  );
}
