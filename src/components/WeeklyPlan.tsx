"use client";

import { CalendarDays, Plus, X } from "lucide-react";
import { useState } from "react";
import { today, weekdayNames } from "@/lib/date";
import { useT } from "@/locales";
import type { PlanStats } from "@/lib/plan";
import { useDashboard } from "@/store/useDashboard";
import { useMounted } from "./motion";
import { CheckButton, GlassCard, Stepper, Toggle, cn } from "./ui";

export function WeeklyPlan({ stats }: { stats: PlanStats }) {
  const plan = useDashboard((s) => s.plan);
  const updatePlan = useDashboard((s) => s.updatePlan);
  const niches = useDashboard((s) => s.niches);
  const addNiche = useDashboard((s) => s.addNiche);
  const removeNiche = useDashboard((s) => s.removeNiche);
  const commitments = useDashboard((s) => s.commitments);
  const addCommitment = useDashboard((s) => s.addCommitment);
  const toggleCommitment = useDashboard((s) => s.toggleCommitment);
  const removeCommitment = useDashboard((s) => s.removeCommitment);

  const [nicheDraft, setNicheDraft] = useState("");
  const [commitDraft, setCommitDraft] = useState("");
  const todayIso = today();
  const t = useT();
  const shortDays = weekdayNames(true);
  const mounted = useMounted();
  const maxBar = Math.max(stats.dailyQuota, ...stats.thisWeekDays.map((d) => d.sent), 1);

  return (
    <GlassCard
      icon={CalendarDays}
      iconTone="var(--purple)"
      eyebrow={stats.currentWeek ? t("{w}-hafta", { w: stats.currentWeek }) : t("Haftalik plan")}
      title={t("Haftalik Plan")}
      subtitle={t("{n} ta taklif · har bir prospektga qo'ng'iroq · Notion hisobot", { n: stats.weeklyTarget })}
      delay={60}
    >
      {/* Targets */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass-strong flex flex-col gap-2 p-3.5">
          <span className="label">{t("Haftalik maqsad")}</span>
          {plan.autoWeekly ? (
            <div className="flex items-baseline gap-1.5">
              <span className="tabular text-[26px] leading-none font-semibold">{stats.weeklyTarget}</span>
              <span className="text-3 text-[12px]">{t("avto · {m}/{w}", { m: plan.monthlyTarget, w: plan.weeks })}</span>
            </div>
          ) : (
            <Stepper label={t("Haftalik maqsad")} value={plan.weeklyTarget} min={1} onChange={(v) => updatePlan({ weeklyTarget: v })} />
          )}
        </div>
        <div className="glass-strong flex flex-col gap-2 p-3.5">
          <span className="label">{t("Ish kunlari")}</span>
          <Stepper label={t("Haftadagi ish kunlari")} value={plan.workdaysPerWeek} min={1} max={7} onChange={(v) => updatePlan({ workdaysPerWeek: v })} />
        </div>
        <div className="glass-strong flex flex-col gap-2 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="label whitespace-nowrap">{t("Kunlik kvota")}</span>
            <Toggle
              small
              label={t("Kunlik kvotani avtomatik hisoblash")}
              checked={plan.autoDaily}
              onChange={(v) => updatePlan({ autoDaily: v, dailyQuota: stats.dailyQuota })}
            />
          </div>
          {plan.autoDaily ? (
            <div className="flex items-baseline gap-1.5">
              <span className="tabular text-[26px] leading-none font-semibold">{stats.dailyQuota}</span>
              <span className="text-3 text-[12px]">{t("ta / kun · avto")}</span>
            </div>
          ) : (
            <Stepper label={t("Kunlik kvota")} value={plan.dailyQuota} min={1} onChange={(v) => updatePlan({ dailyQuota: v })} />
          )}
        </div>
      </div>

      {/* This week, by day */}
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="label">{t("Shu hafta kunlar kesimida")}</span>
          <span className="text-2 tabular text-[12px]">
            {t("{p} taklif · {c} qo'ng'iroq", { p: stats.thisWeekDays.reduce((s, d) => s + d.sent, 0), c: stats.thisWeekDays.reduce((s, d) => s + d.calls, 0) })}
          </span>
        </div>
        <div className="grid grid-cols-7 items-end gap-2" style={{ height: 112 }}>
          {stats.thisWeekDays.map((d, i) => {
            const h = mounted ? Math.round((d.sent / maxBar) * 72) : 0;
            const quotaH = Math.round((stats.dailyQuota / maxBar) * 72);
            const isToday = d.date === todayIso;
            const hit = d.sent >= stats.dailyQuota;
            return (
              <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1.5" title={t("{p} taklif, {c} qo'ng'iroq", { p: d.sent, c: d.calls })}>
                <span className="tabular text-2 text-[11px] font-semibold">{d.sent || ""}</span>
                <div className="relative w-full max-w-9" style={{ height: 72 }}>
                  {d.isWorkday && (
                    <div className="absolute inset-x-0 border-t border-dashed" style={{ bottom: quotaH, borderColor: "var(--text-3)" }} />
                  )}
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-[10px] transition-[height] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      height: Math.max(h, d.isWorkday ? 4 : 2),
                      background: d.sent
                        ? hit
                          ? "linear-gradient(180deg, color-mix(in srgb, var(--green) 75%, #fff), var(--green))"
                          : "linear-gradient(180deg, color-mix(in srgb, var(--accent) 75%, #fff), var(--accent))"
                        : "var(--track)",
                      boxShadow: d.sent ? "inset 0 1px 0 rgb(255 255 255 / 0.45)" : undefined,
                    }}
                  />
                </div>
                <span className={cn("text-[11px] font-semibold", isToday ? "" : "text-3")} style={isToday ? { color: "var(--accent)" } : undefined}>
                  {shortDays[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Focus niches */}
      <div className="mt-5">
        <span className="label">{t("Fokus nishalar")}</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {niches.map((n) => (
            <span key={n} className="pill tone-purple h-7 pr-1 pl-3 text-[12px]">
              {n}
              <button type="button" className="icon-btn size-5" aria-label={t("{n} nishasini o'chirish", { n })} onClick={() => removeNiche(n)}>
                <X size={12} />
              </button>
            </span>
          ))}
          <form
            className="flex"
            onSubmit={(e) => {
              e.preventDefault();
              addNiche(nicheDraft);
              setNicheDraft("");
            }}
          >
            <input
              className="field h-7 w-40 rounded-full py-0 text-[12px]"
              placeholder={t("+ Nisha qo'shish")}
              value={nicheDraft}
              maxLength={60}
              onChange={(e) => setNicheDraft(e.target.value)}
              aria-label={t("Yangi nisha")}
            />
          </form>
        </div>
      </div>

      {/* Commitments */}
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="label">{t("Hafta majburiyatlari")}</span>
          <span className="text-2 tabular text-[12px]">
            {commitments.filter((c) => c.done).length}/{commitments.length}
          </span>
        </div>
        <ul className="flex flex-col">
          {commitments.map((c) => (
            <li key={c.id} className="group hairline flex items-center gap-3 border-b py-2.5 last:border-b-0">
              <CheckButton checked={c.done} onChange={() => toggleCommitment(c.id)} label={c.text} />
              <span className={cn("flex-1 text-[14px] transition-colors", c.done && "text-3 line-through")}>{c.text}</span>
              <button
                type="button"
                className="icon-btn size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={t("O'chirish")}
                onClick={() => removeCommitment(c.id)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addCommitment(commitDraft);
            setCommitDraft("");
          }}
        >
          <input
            className="field"
            placeholder={t("Yangi haftalik vazifa…")}
            value={commitDraft}
            maxLength={160}
            onChange={(e) => setCommitDraft(e.target.value)}
            aria-label={t("Yangi haftalik vazifa")}
          />
          <button type="submit" className="btn btn-glass" disabled={!commitDraft.trim()}>
            <Plus size={15} />
            {t("Qo'shish")}
          </button>
        </form>
      </div>
    </GlassCard>
  );
}
