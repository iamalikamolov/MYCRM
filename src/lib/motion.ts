// Small, dependency-free motion helpers. All respect "prefers-reduced-motion".
import { flushSync } from "react-dom";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => ViewTransitionLike };

/**
 * Runs a state update inside a View Transition so elements with a `view-transition-name`
 * (Kanban cards) glide to their new place. Falls back to a plain update.
 */
export function withViewTransition(update: () => void): void {
  const doc = document as ViewTransitionDoc;
  if (!doc.startViewTransition || prefersReducedMotion() || doc.hidden) {
    update();
    return;
  }
  const vt = doc.startViewTransition(() => flushSync(update));
  // An aborted/skipped animation must never surface as an error — the update itself already ran.
  const ignore = () => undefined;
  vt.ready.catch(ignore);
  vt.finished.catch(ignore);
  vt.updateCallbackDone.catch(ignore);
}

// ─── Confetti ────────────────────────────────────────────────────────────────
const COLORS = ["#f0a64a", "#f6c98a", "#4cc97a", "#fff4e4", "#ff8f6b", "#c48cf0"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
  shape: 0 | 1;
}

/** Fires a confetti burst from (x, y) in viewport pixels. Default: center of the screen. */
export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 2.5, count = 140): void {
  if (prefersReducedMotion()) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "100" });
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const pieces: Piece[] = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const speed = 7 + Math.random() * 11;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      life: 1,
      shape: Math.random() > 0.3 ? 0 : 1,
    };
  });

  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(2, (now - last) / 16.67);
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = 0;
    for (const p of pieces) {
      p.vy += 0.32 * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= 0.008 * dt;
      if (p.life <= 0 || p.y > window.innerHeight + 40) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 0) {
        // flutter: scale Y with rotation so strips look like they spin in 3D
        ctx.scale(1, Math.cos(p.rot * 3));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive > 0) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

/** Confetti from the center of an element (e.g. the button that was clicked). */
export function confettiFrom(el: Element | null | undefined): void {
  if (!el) return confetti();
  const r = el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2);
}
