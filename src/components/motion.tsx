"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/** true after the first paint — lets bars/rings animate from 0 on mount. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Animates a number from its previous value (0 on mount) to `value`. */
export function useCountUp(value: number, duration = 1100): number {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = a + (value - a) * easeOutExpo(t);
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return shown;
}

export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US"), duration }: { value: number; format?: (n: number) => string; duration?: number }) {
  const v = useCountUp(value, duration);
  return <span className="tabular">{format(v)}</span>;
}

/**
 * One global pointer listener that drives:
 * - the cursor spotlight + glowing rim on the glass panel under the cursor (--mx/--my)
 * - 3D tilt on elements with [data-tilt] (--rx/--ry)
 * - the ambient background parallax (--px/--py on .ambient)
 */
export function PointerFX() {
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const ambient = document.querySelector<HTMLElement>(".ambient");
    let lit: HTMLElement[] = [];
    let tilted: HTMLElement | null = null;
    let raf = 0;
    let ev: PointerEvent | null = null;

    const frame = () => {
      raf = 0;
      if (!ev) return;
      const { clientX: x, clientY: y } = ev;
      const target = ev.target instanceof Element ? ev.target : null;

      // Light every glass layer under the cursor (a card and the panel it sits in).
      const next: HTMLElement[] = [];
      let el = target?.closest<HTMLElement>(".glass, .glass-strong, .glass-chip") ?? null;
      while (el && next.length < 3) {
        next.push(el);
        el = el.parentElement?.closest<HTMLElement>(".glass, .glass-strong, .glass-chip") ?? null;
      }
      for (const old of lit) if (!next.includes(old)) old.style.removeProperty("--mx"), old.style.removeProperty("--my");
      for (const n of next) {
        const r = n.getBoundingClientRect();
        n.style.setProperty("--mx", `${x - r.left}px`);
        n.style.setProperty("--my", `${y - r.top}px`);
      }
      lit = next;

      const t = target?.closest<HTMLElement>("[data-tilt]") ?? null;
      if (tilted && tilted !== t) tilted.style.removeProperty("--rx"), tilted.style.removeProperty("--ry");
      if (t) {
        const r = t.getBoundingClientRect();
        const dx = (x - r.left) / r.width - 0.5;
        const dy = (y - r.top) / r.height - 0.5;
        t.style.setProperty("--rx", `${(-dy * 9).toFixed(2)}deg`);
        t.style.setProperty("--ry", `${(dx * 11).toFixed(2)}deg`);
      }
      tilted = t;

      if (ambient) {
        ambient.style.setProperty("--px", ((x / window.innerWidth) * 2 - 1).toFixed(3));
        ambient.style.setProperty("--py", ((y / window.innerHeight) * 2 - 1).toFixed(3));
      }
    };

    const onMove = (e: PointerEvent) => {
      ev = e;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onLeave = () => {
      for (const old of lit) old.style.removeProperty("--mx"), old.style.removeProperty("--my");
      lit = [];
      if (tilted) tilted.style.removeProperty("--rx"), tilted.style.removeProperty("--ry");
      tilted = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
