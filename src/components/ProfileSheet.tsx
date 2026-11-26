"use client";

import { Camera, Check, Crop, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import { useT } from "@/locales";
import { useDashboard } from "@/store/useDashboard";
import { Modal } from "./SettingsSheet";
import { cn, toast } from "./ui";

const AVATAR_PX = 256;
const SOURCE_MAX_PX = 900;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const VIEW = 240; // crop circle size in CSS px
const MAX_ZOOM = 8;

type CropState = { cx: number; cy: number; zoom: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode"));
    i.src = src;
  });
}

/** Reads a picked file and downsizes it (keeps the whole picture) so it can be re-cropped later. */
async function fileToSource(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not-image");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("too-big");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, SOURCE_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Geometry of the image inside the crop circle for a given crop state. */
function layout(w: number, h: number, c: CropState) {
  const scale = (VIEW / Math.min(w, h)) * c.zoom;
  const W = w * scale;
  const H = h * scale;
  // Keep the circle fully covered by the image.
  const ox = Math.min(0, Math.max(VIEW - W, VIEW / 2 - c.cx * W));
  const oy = Math.min(0, Math.max(VIEW - H, VIEW / 2 - c.cy * H));
  return { scale, W, H, ox, oy };
}

async function renderAvatar(src: string, c: CropState): Promise<string> {
  const img = await loadImage(src);
  const { scale, ox, oy } = layout(img.naturalWidth, img.naturalHeight, c);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, -ox / scale, -oy / scale, VIEW / scale, VIEW / scale, 0, 0, AVATAR_PX, AVATAR_PX);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export function initialsOf(first: string, last: string): string {
  return `${first.trim()[0] ?? ""}${last.trim()[0] ?? ""}`.toUpperCase();
}

/** Profile photo, or initials, or a person icon. */
export function Avatar({ size = 36, className, ring }: { size?: number; className?: string; ring?: boolean }) {
  const profile = useDashboard((s) => s.profile);
  const t = useT();
  const initials = initialsOf(profile.firstName, profile.lastName);
  return (
    <span
      className={cn("relative grid flex-none place-items-center overflow-hidden rounded-full font-bold", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: profile.avatar ? undefined : "linear-gradient(140deg, var(--accent), var(--accent-2))",
        color: "var(--on-accent)",
        boxShadow: ring
          ? "0 0 0 2px var(--glass-bg-strong), 0 0 0 4px color-mix(in srgb, var(--accent) 70%, transparent), 0 10px 30px -8px var(--accent)"
          : "inset 0 1px 0 rgb(255 255 255 / 0.35)",
      }}
    >
      {profile.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL, no optimization needed
        <img src={profile.avatar} alt={t("Profil rasmi")} className="size-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <UserRound size={size * 0.5} />
      )}
    </span>
  );
}

// ─── Crop editor ─────────────────────────────────────────────────────────────
// Classic crop tool: the whole photo is shown, a square frame marks the part to keep.
// Drag inside the frame to move it, drag a corner to resize it; everything outside is cut off.
// The frame is stored as CropState (centre + zoom), so renderAvatar() stays the same.
const STAGE = 300; // max width/height of the photo on screen
const MIN_FRAME_PX = 48; // smallest frame on screen

type Frame = { x: number; y: number; s: number }; // centre + side, in image pixels

function frameFromCrop(w: number, h: number, c: CropState): Frame {
  const m = Math.min(w, h);
  const s = m / c.zoom;
  return clampFrame(w, h, { x: c.cx * w, y: c.cy * h, s });
}

function clampFrame(w: number, h: number, f: Frame, minS = Math.min(w, h) / MAX_ZOOM): Frame {
  const s = Math.min(Math.min(w, h), Math.max(minS, f.s));
  return { s, x: Math.min(w - s / 2, Math.max(s / 2, f.x)), y: Math.min(h - s / 2, Math.max(s / 2, f.y)) };
}

function cropFromFrame(w: number, h: number, f: Frame): CropState {
  return { cx: f.x / w, cy: f.y / h, zoom: Math.min(w, h) / f.s };
}

type Corner = "nw" | "ne" | "sw" | "se";
const CORNERS: { c: Corner; cls: string; cursor: string }[] = [
  { c: "nw", cls: "-top-2 -left-2", cursor: "nwse-resize" },
  { c: "ne", cls: "-top-2 -right-2", cursor: "nesw-resize" },
  { c: "sw", cls: "-bottom-2 -left-2", cursor: "nesw-resize" },
  { c: "se", cls: "-right-2 -bottom-2", cursor: "nwse-resize" },
];

function CropEditor({ src, initial, onApply, onCancel }: { src: string; initial: CropState | null; onApply: (c: CropState) => void; onCancel: () => void }) {
  const t = useT();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const drag = useRef<{ mode: "move" | Corner; px: number; py: number; start: Frame } | null>(null);

  useEffect(() => {
    let alive = true;
    void loadImage(src).then((img) => {
      if (!alive) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setSize({ w, h });
      // Default: the largest centred square (or the previously saved crop).
      setFrame(frameFromCrop(w, h, initial ?? { cx: 0.5, cy: 0.5, zoom: 1 }));
    });
    return () => {
      alive = false;
    };
  }, [src, initial]);

  if (!size || !frame) return <div className="grid h-[300px] place-items-center text-[13px] text-3">…</div>;

  const k = Math.min(STAGE / size.w, STAGE / size.h); // image px → screen px
  const dw = size.w * k;
  const dh = size.h * k;
  const minS = Math.max(Math.min(size.w, size.h) / MAX_ZOOM, MIN_FRAME_PX / k);
  const set = (f: Frame) => setFrame(clampFrame(size.w, size.h, f, minS));

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / k;
    const dy = (e.clientY - d.py) / k;
    if (d.mode === "move") return set({ ...d.start, x: d.start.x + dx, y: d.start.y + dy });
    // Resize from a corner while the opposite corner stays put.
    const sx = d.mode === "ne" || d.mode === "se" ? 1 : -1;
    const sy = d.mode === "sw" || d.mode === "se" ? 1 : -1;
    const ax = d.start.x - (sx * d.start.s) / 2; // anchor = opposite corner
    const ay = d.start.y - (sy * d.start.s) / 2;
    let s = Math.max(sx * dx, sy * dy) + d.start.s;
    // Keep the frame inside the photo on the side it grows towards.
    const roomX = sx > 0 ? size.w - ax : ax;
    const roomY = sy > 0 ? size.h - ay : ay;
    s = Math.min(s, roomX, roomY);
    s = Math.max(minS, s);
    setFrame({ s, x: ax + (sx * s) / 2, y: ay + (sy * s) / 2 });
  };

  const start = (mode: "move" | Corner) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, px: e.clientX, py: e.clientY, start: frame };
  };

  const P = 88; // preview size
  const pk = P / frame.s;
  const zoom = Math.min(size.w, size.h) / frame.s;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="text-[15px] font-semibold">{t("Rasmning qaysi qismi qolsin?")}</div>
        <div className="text-3 text-[12px]">{t("Ramkani suring yoki burchagidan torting — tashqaridagi qism kesib tashlanadi")}</div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-5">
        <div
          className="relative touch-none overflow-hidden rounded-xl select-none"
          style={{ width: dw, height: dh, background: "var(--track)" }}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL in an editor */}
          <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full" />
          {/* The frame: a giant shadow darkens everything that will be cut off. */}
          <div
            role="slider"
            tabIndex={0}
            aria-label={t("Ramka o'lchami")}
            aria-valuemin={1}
            aria-valuemax={MAX_ZOOM}
            aria-valuenow={Number(zoom.toFixed(2))}
            onPointerDown={start("move")}
            onKeyDown={(e) => {
              const step = 6 / k;
              const map: Record<string, Frame> = {
                ArrowLeft: { ...frame, x: frame.x - step },
                ArrowRight: { ...frame, x: frame.x + step },
                ArrowUp: { ...frame, y: frame.y - step },
                ArrowDown: { ...frame, y: frame.y + step },
                "+": { ...frame, s: frame.s / 1.08 },
                "=": { ...frame, s: frame.s / 1.08 },
                "-": { ...frame, s: frame.s * 1.08 },
              };
              const next = map[e.key];
              if (next) {
                e.preventDefault();
                set(next);
              }
            }}
            className="absolute cursor-move outline-none focus-visible:ring-2"
            style={{
              left: (frame.x - frame.s / 2) * k,
              top: (frame.y - frame.s / 2) * k,
              width: frame.s * k,
              height: frame.s * k,
              boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55), inset 0 0 0 2px rgb(255 255 255 / 0.95)",
            }}
          >
            {/* Final avatar is round: show that circle and a rule-of-thirds grid. */}
            <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.7)" }} />
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(to right, transparent calc(33.33% - 0.5px), #fff calc(33.33% - 0.5px), #fff calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), #fff calc(66.66% - 0.5px), #fff calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)), linear-gradient(to bottom, transparent calc(33.33% - 0.5px), #fff calc(33.33% - 0.5px), #fff calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), #fff calc(66.66% - 0.5px), #fff calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))",
              }}
            />
            {CORNERS.map(({ c, cls, cursor }) => (
              <span
                key={c}
                onPointerDown={start(c)}
                className={`absolute size-4 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.45)] ${cls}`}
                style={{ cursor }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="relative overflow-hidden rounded-full" style={{ width: P, height: P, boxShadow: "0 0 0 3px var(--glass-bg-strong), 0 0 0 5px color-mix(in srgb, var(--accent) 60%, transparent)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- live preview */}
            <img
              src={src}
              alt=""
              className="absolute top-0 left-0 max-w-none"
              style={{ width: size.w * pk, height: size.h * pk, transform: `translate(${-(frame.x - frame.s / 2) * pk}px, ${-(frame.y - frame.s / 2) * pk}px)` }}
            />
          </div>
          <span className="label">{t("Ko'rinishi")}</span>
        </div>
      </div>

      <label className="flex w-full max-w-[320px] items-center gap-2">
        <span className="text-3 text-[12px] whitespace-nowrap">{t("Ramka o'lchami")}</span>
        <input
          type="range"
          min={100}
          max={Math.round(MAX_ZOOM * 100)}
          value={Math.round(zoom * 100)}
          onChange={(e) => set({ ...frame, s: Math.min(size.w, size.h) / (Number(e.target.value) / 100) })}
          className="flex-1 accent-[var(--accent)]"
        />
      </label>

      <div className="flex w-full gap-2">
        <button type="button" className="btn btn-glass" onClick={onCancel}>
          {t("Bekor qilish")}
        </button>
        <button type="button" className="btn btn-primary h-10 flex-1" onClick={() => onApply(cropFromFrame(size.w, size.h, frame))}>
          <Check size={15} strokeWidth={3} />
          {t("Qo'llash")}
        </button>
      </div>
    </div>
  );
}

// ─── Profile sheet ───────────────────────────────────────────────────────────
export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useDashboard((s) => s.profile);
  const updateProfile = useDashboard((s) => s.updateProfile);
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Profile>(profile);
  const [cropping, setCropping] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Start from the saved profile every time the sheet opens.
  useEffect(() => {
    if (open) {
      setForm(profile);
      setError("");
      setCropping(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const src = await fileToSource(file);
      setForm((f) => ({ ...f, avatarSrc: src, avatarCrop: null }));
      setCropping(src);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setError(m === "too-big" ? t("Rasm juda katta (15 MB dan oshmasin)") : t("Bu faylni rasm sifatida ochib bo'lmadi"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const initials = initialsOf(form.firstName, form.lastName);

  return (
    <Modal open={open} onClose={onClose} title={t("Profil")} icon={UserRound}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

      {cropping ? (
        <CropEditor
          src={cropping}
          initial={form.avatarSrc === cropping ? (form.avatarCrop ?? null) : null}
          onCancel={() => setCropping(null)}
          onApply={async (c) => {
            const avatar = await renderAvatar(cropping, c);
            setForm((f) => ({ ...f, avatar, avatarSrc: cropping, avatarCrop: c }));
            setCropping(null);
          }}
        />
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateProfile({
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              goal: form.goal.trim(),
              avatar: form.avatar,
              avatarSrc: form.avatar ? (form.avatarSrc ?? null) : null,
              avatarCrop: form.avatar ? (form.avatarCrop ?? null) : null,
            });
            toast(t("Profil saqlandi"));
            onClose();
          }}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => (form.avatarSrc ? setCropping(form.avatarSrc) : fileRef.current?.click())}
              className="group relative grid size-24 flex-none place-items-center overflow-hidden rounded-full text-[30px] font-bold"
              style={{
                background: form.avatar ? undefined : "linear-gradient(140deg, var(--accent), var(--accent-2))",
                color: "var(--on-accent)",
                boxShadow: "0 0 0 3px var(--glass-bg-strong), 0 0 0 5px color-mix(in srgb, var(--accent) 60%, transparent), 0 16px 40px -12px var(--accent)",
              }}
              aria-label={form.avatarSrc ? t("Joylashuvni o'zgartirish") : t("Rasm tanlash")}
            >
              {form.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
                <img src={form.avatar} alt="" className="size-full object-cover" />
              ) : initials ? (
                initials
              ) : (
                <UserRound size={40} />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {form.avatarSrc ? <Crop size={22} /> : <Camera size={22} />}
              </span>
            </button>
            <div className="flex flex-col gap-2">
              <button type="button" className="btn btn-glass" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Camera size={14} />
                {busy ? t("Yuklanmoqda…") : form.avatar ? t("Rasmni almashtirish") : t("Rasm yuklash")}
              </button>
              {form.avatarSrc && form.avatar && (
                <button type="button" className="btn btn-glass" onClick={() => setCropping(form.avatarSrc ?? null)}>
                  <Crop size={14} />
                  {t("Joylashuvni o'zgartirish")}
                </button>
              )}
              {form.avatar && (
                <button
                  type="button"
                  className="btn btn-glass"
                  style={{ color: "var(--red)" }}
                  onClick={() => setForm((f) => ({ ...f, avatar: null, avatarSrc: null, avatarCrop: null }))}
                >
                  <Trash2 size={14} />
                  {t("Rasmni olib tashlash")}
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className="-mt-1 text-[13px]" role="alert" style={{ color: "var(--red)" }}>
              {error}
            </p>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="label">{t("Ism")}</span>
              <input className="field h-11" value={form.firstName} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder={t("Ismingiz")} autoComplete="given-name" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">{t("Familiya")}</span>
              <input className="field h-11" value={form.lastName} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder={t("Familiyangiz")} autoComplete="family-name" />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="label">{t("Maqsadim")}</span>
            <textarea
              className="field"
              rows={2}
              maxLength={200}
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              placeholder={t("Masalan: Shu oy 10 ta mijoz va $5 000 daromad")}
            />
            <span className="text-3 text-right text-[11px]">{form.goal.length}/200</span>
          </label>

          <div className="flex gap-2">
            <button type="button" className="btn btn-glass" onClick={onClose}>
              {t("Bekor qilish")}
            </button>
            <button type="submit" className="btn btn-primary h-10 flex-1">
              <Check size={15} strokeWidth={3} />
              {t("Saqlash")}
            </button>
          </div>
          <p className="text-3 text-[12px]">{t("Rasm va ma'lumotlar faqat shu brauzerda, shifrlangan holda saqlanadi.")}</p>
        </form>
      )}
    </Modal>
  );
}
