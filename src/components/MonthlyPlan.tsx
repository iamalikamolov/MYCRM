"use client";

import { BadgeDollarSign, CalendarRange, Check, MessageSquareText, PhoneCall, Send, Settings2, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { formatDayMonth } from "@/lib/date";
import { type PlanStats, pct, planEndDate } from "@/lib/plan";
import { type SalesStats, usd } from "@/lib/sales";
import { useDashboard } from "@/store/useDashboard";
import { CountUp } from "./motion";
import { useT } from "@/locales";
import { GlassCard, ProgressBar, ProgressRing, Stepper, Toggle } from "./ui";

function Metric({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  progress,
  className,
}: {
  className?: string;
  icon: typeof Send;
  tone: string;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  progress?: number;
}) {
  return (
    <div data-tilt className={`glass-strong flex flex-col gap-2.5 p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <Icon size={16} style={{ color: tone }} />
      </div>
      <div className="tabular text-[28px] leading-none font-semibold tracking-[-0.03em]">{value}</div>
      {progress !== undefined && <ProgressBar value={progress} from={tone} to={tone} label={label} className="h-1.5" />}
      <div className="text-2 text-[12px]">{sub}</div>
    </div>
  );
}

export function MonthlyPlan({ stats, sales }: { stats: PlanStats; sales: SalesStats }) {
  const plan = useDashboard((s) => s.plan);
  const updatePlan = useDashboard((s) => s.updatePlan);
  const notesCount = useDashboard((s) => s.notes.length);
  const [editing, setEditing] = useState(false);
  const t = useT();

  const monthPct = pct(stats.sentMonth, stats.monthlyTarget);
  const weekPct = pct(stats.sentWeek, stats.weeklyTarget);
  const done = stats.remainingMonth === 0;

  return (
    <GlassCard
            icon={Target}
      eyebrow={t("1 oylik mijoz topish plani")}
      title={t("{n} ta taklif — {w} haftada", { n: stats.monthlyTarget, w: plan.weeks })}
      subtitle={t("{from} – {to} · {n} kun qoldi", { from: formatDayMonth(plan.startDate), to: formatDayMonth(planEndDate(plan)), n: stats.daysLeft })}
      actions={
        <button type="button" className="btn btn-glass" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? <Check size={15} /> : <Settings2 size={15} />}
          {editing ? t("Tayyor") : t("Maqsadni sozlash")}
        </button>
      }
    >
      {editing && (
        <div className="glass-strong fade-in mb-5 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-2">
            <span className="label">{t("Oylik maqsad")}</span>
            <Stepper label={t("Oylik maqsad")} value={plan.monthlyTarget} min={1} onChange={(v) => updatePlan({ monthlyTarget: v })} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="label">{t("Haftalar soni")}</span>
            <Stepper label={t("Haftalar soni")} value={plan.weeks} min={1} max={6} onChange={(v) => updatePlan({ weeks: v })} />
          </label>
          <div className="flex flex-col gap-2">
            <span className="label">{t("Haftalik maqsad")}</span>
            <div className="flex items-center gap-3">
              {plan.autoWeekly ? (
                <span className="tabular text-[22px] font-semibold">{stats.weeklyTarget}</span>
              ) : (
                <Stepper label={t("Haftalik maqsad")} value={plan.weeklyTarget} min={1} onChange={(v) => updatePlan({ weeklyTarget: v })} />
              )}
              <span className="text-2 flex items-center gap-2 text-[12px]">
                <Toggle
                  label={t("Haftalik maqsadni avtomatik hisoblash")}
                  checked={plan.autoWeekly}
                  onChange={(v) => updatePlan({ autoWeekly: v, weeklyTarget: stats.weeklyTarget })}
                />
                {t("Avto")}
              </span>
            </div>
          </div>
          <label className="flex flex-col gap-2">
            <span className="label">{t("Boshlanish sanasi")}</span>
            <input
              type="date"
              className="field"
              value={plan.startDate}
              onChange={(e) => e.target.value && updatePlan({ startDate: e.target.value })}
            />
          </label>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-5 lg:flex-col lg:items-center lg:justify-center lg:px-4">
          <ProgressRing value={monthPct}>
            <div>
              <div className="tabular text-[38px] leading-none font-semibold tracking-[-0.04em]">
                <CountUp value={stats.sentMonth} />
              </div>
              <div className="text-2 mt-1 text-[12px] font-medium">{t("/ {n} taklif", { n: stats.monthlyTarget })}</div>
              <div className="pill tone-accent mt-2">
                <CountUp value={monthPct} />%
              </div>
            </div>
          </ProgressRing>
          <div className="text-[13px] lg:text-center">
            {done ? (
              <span className="pill tone-green">{t("Oylik maqsad bajarildi 🎉")}</span>
            ) : (
              <>
                <div className="text-2">{t("Kerakli temp")}</div>
                <div className="tabular text-[17px] font-semibold">
                  {t("{n} ta / ish kuni", { n: stats.requiredPace })}
                </div>
                <div className="text-3 text-[12px]">{t("{n} ish kuni qoldi", { n: stats.workdaysLeft })}</div>
              </>
            )}
          </div>
        </div>

        <div className="stagger grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            className="xl:col-span-2"
            icon={Send}
            tone="var(--accent)"
            label={t("Oyda qoldi")}
            value={<CountUp value={stats.remainingMonth} />}
            progress={monthPct}
            sub={t("{n} ta yuborildi", { n: stats.sentMonth })}
          />
          <Metric
            className="xl:col-span-2"
            icon={CalendarRange}
            tone="var(--purple)"
            label={stats.currentWeek ? t("{w}-hafta qoldi", { w: stats.currentWeek }) : t("Hafta")}
            value={stats.currentWeek ? <CountUp value={stats.remainingWeek} /> : "—"}
            progress={weekPct}
            sub={stats.currentWeek ? t("{sent} / {target} bu hafta", { sent: stats.sentWeek, target: stats.weeklyTarget }) : t("Plan davridan tashqarida")}
          />
          <Metric
            className="xl:col-span-2"
            icon={PhoneCall}
            tone="var(--green)"
            label={t("Qo'ng'iroqlar")}
            value={<CountUp value={stats.callsMonth} />}
            progress={stats.callCoverage}
            sub={t("Prospektlarning {n}% iga qo'ng'iroq", { n: stats.callCoverage })}
          />
          <Metric
            className="xl:col-span-3"
            icon={MessageSquareText}
            tone="var(--orange)"
            label={t("Javob / mulohaza")}
            value={<CountUp value={notesCount} />}
            sub={t("Notionga yoziladigan mulohazalar")}
          />
          <Metric
            className="xl:col-span-3"
            icon={BadgeDollarSign}
            tone="var(--green)"
            label={t("Sotuvlar")}
            value={<CountUp value={sales.revenue} format={(n) => usd(Math.round(n))} />}
            sub={t("{n} ta sotuv · konversiya {c}%", { n: sales.count, c: sales.conversion ?? 0 })}
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-3" />
          <span className="label">{t("Haftalar bo'yicha")}</span>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stats.perWeek.length}, minmax(0, 1fr))` }}>
          {stats.perWeek.map((w) => {
            const current = w.week === stats.currentWeek;
            const p = pct(w.sent, w.target);
            return (
              <div key={w.week} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className={current ? "font-semibold" : "text-2"}>
                    {t("{w}-hafta", { w: w.week })} {current && <span className="pill tone-accent ml-1 h-5 px-2">{t("hozir")}</span>}
                  </span>
                  <span className="tabular text-2">
                    {w.sent}/{w.target}
                  </span>
                </div>
                <ProgressBar
                  value={p}
                  label={t("{w}-hafta", { w: w.week })}
                  from={p >= 100 ? "var(--green)" : undefined}
                  to={p >= 100 ? "var(--green)" : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
