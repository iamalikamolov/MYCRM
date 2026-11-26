"use client";

import { ChevronDown, ChevronUp, Clock, ListChecks, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { confetti } from "@/lib/motion";
import { toast } from "./ui";
import { useT } from "@/locales";
import { formatLong, timeToMinutes, today } from "@/lib/date";
import { pct } from "@/lib/plan";
import { useDashboard } from "@/store/useDashboard";
import { CheckButton, GlassCard, ProgressBar, cn } from "./ui";

function useNowMinutes(): number {
  const [now, setNow] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function DailyRoutine() {
  const routine = useDashboard((s) => s.routine);
  const toggle = useDashboard((s) => s.toggleRoutine);
  const add = useDashboard((s) => s.addRoutine);
  const remove = useDashboard((s) => s.removeRoutine);
  const move = useDashboard((s) => s.moveRoutine);
  const reset = useDashboard((s) => s.resetRoutine);
  const ensureDay = useDashboard((s) => s.ensureRoutineDay);
  const now = useNowMinutes();
  const t = useT();

  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(30);
  const [title, setTitle] = useState("");

  // Ticks belong to one day: when the date rolls over, start fresh.
  useEffect(() => {
    ensureDay();
    const id = setInterval(ensureDay, 60_000);
    return () => clearInterval(id);
  }, [ensureDay]);

  const doneCount = routine.filter((r) => r.done).length;
  const progress = pct(doneCount, routine.length);
  // Celebrate the moment the whole routine gets ticked off (not on page load).
  const prevProgress = useRef(progress);
  useEffect(() => {
    if (progress === 100 && prevProgress.current < 100 && routine.length > 0) {
      confetti();
      toast(t("Kun tartibi 100% bajarildi! 🎉"));
    }
    prevProgress.current = progress;
  }, [progress, routine.length]);
  const doneMinutes = routine.filter((r) => r.done).reduce((s, r) => s + r.durationMin, 0);
  const totalMinutes = routine.reduce((s, r) => s + r.durationMin, 0);
  const currentId = routine.find((r) => {
    const start = timeToMinutes(r.time);
    return now >= start && now < start + r.durationMin;
  })?.id;

  return (
    <GlassCard
      icon={ListChecks}
      iconTone="var(--green)"
      eyebrow={formatLong(today())}
      title={t("Kun Tartibi")}
      subtitle={t("Ish kuni bloklari — tartib bilan, birma-bir")}
      delay={120}
      actions={
        <button type="button" className="btn btn-glass" onClick={reset} title={t("Belgilarni tozalash")}>
          <RotateCcw size={14} />
          {t("Qayta boshlash")}
        </button>
      }
    >
      <div className="glass-strong mb-4 flex items-center gap-4 p-4">
        <div className="tabular text-[32px] leading-none font-semibold tracking-[-0.03em]" style={{ color: progress === 100 ? "var(--green)" : undefined }}>
          {progress}%
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <ProgressBar value={progress} from="var(--green)" to="color-mix(in srgb, var(--green) 60%, var(--accent))" label={t("Kun tartibi bajarilishi")} />
          <div className="text-2 flex justify-between text-[12px]">
            <span>
              {t("{done}/{total} blok bajarildi", { done: doneCount, total: routine.length })}
            </span>
            <span className="tabular">
              {t("{h}s {m}d", { h: Math.floor(doneMinutes / 60), m: doneMinutes % 60 })} / {t("{h}s {m}d", { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 })}
            </span>
          </div>
        </div>
      </div>

      <ol className="relative flex flex-col gap-1">
        {routine.map((r, i) => {
          const current = r.id === currentId;
          return (
            <li
              key={r.id}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors",
                current ? "" : "hover:bg-[var(--track)]",
              )}
              style={
                current
                  ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)" }
                  : undefined
              }
            >
              <CheckButton checked={r.done} onChange={() => toggle(r.id)} label={r.title} />
              <div className="w-[52px] flex-none">
                <div className="tabular text-[13px] font-semibold">{r.time}</div>
                <div className="text-3 tabular text-[11px]">{t("{n} daq", { n: r.durationMin })}</div>
              </div>
              <span className={cn("min-w-0 flex-1 text-[14px] leading-snug", r.done && "text-3 line-through")}>{r.title}</span>
              {current && !r.done && <span className="pill tone-accent">{t("Hozir")}</span>}
              <div className="flex flex-none opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button type="button" className="icon-btn size-7" aria-label={t("Yuqoriga")} disabled={i === 0} onClick={() => move(r.id, -1)}>
                  <ChevronUp size={14} />
                </button>
                <button type="button" className="icon-btn size-7" aria-label={t("Pastga")} disabled={i === routine.length - 1} onClick={() => move(r.id, 1)}>
                  <ChevronDown size={14} />
                </button>
                <button type="button" className="icon-btn size-7" aria-label={t("O'chirish")} onClick={() => remove(r.id)}>
                  <X size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <form
        className="hairline mt-3 flex flex-wrap gap-2 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          add({ time, durationMin: duration, title });
          setTitle("");
        }}
      >
        <div className="relative w-[120px]">
          <Clock size={14} className="text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
          <input type="time" className="field pl-8" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t("Boshlanish vaqti")} required />
        </div>
        <select
          className="field w-[96px]"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          aria-label={t("Davomiyligi")}
        >
          {[15, 20, 30, 45, 60, 90, 120, 180].map((m) => (
            <option key={m} value={m}>
              {t("{n} daq", { n: m })}
            </option>
          ))}
        </select>
        <input
          className="field min-w-[160px] flex-1"
          placeholder={t("Yangi blok, masalan: Follow-up xabarlar")}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          aria-label={t("Blok nomi")}
        />
        <button type="submit" className="btn btn-glass" disabled={!title.trim()}>
          <Plus size={15} />
          {t("Qo'shish")}
        </button>
      </form>
    </GlassCard>
  );
}
