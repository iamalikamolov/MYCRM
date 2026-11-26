"use client";

import { BadgeDollarSign, Percent, Receipt, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDayMonth, today } from "@/lib/date";
import { type SalesStats, usd } from "@/lib/sales";
import { SALE_SERVICES } from "@/lib/types";
import { useDashboard } from "@/store/useDashboard";
import { CountUp, useMounted } from "./motion";
import { serviceLabel } from "./Prospects";
import { MONTHS_SHORT, useLang, useT } from "@/locales";
import { GlassCard, ProgressBar, ProgressRing, cn } from "./ui";


export function SalesView({ sales }: { sales: SalesStats }) {
  const prospects = useDashboard((s) => s.prospects);
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [metric, setMetric] = useState<"revenue" | "count">("revenue");
  const won = useMemo(() => prospects.filter((p) => p.outcome === "won" && p.wonAt).sort((a, b) => b.wonAt!.localeCompare(a.wonAt!)), [prospects]);
  const lost = prospects.filter((p) => p.outcome === "lost").length;

  const months = useMemo(() => {
    const [y, m] = today().split("-").map(Number) as [number, number];
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(y, m - 1 - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const items = won.filter((p) => p.wonAt!.startsWith(key));
      return { key, label: MONTHS_SHORT[lang][d.getMonth()]!, revenue: items.reduce((s, p) => s + p.amount, 0), count: items.length };
    });
  }, [won, lang]);
  const max = Math.max(1, ...months.map((x) => x[metric]));
  const mounted = useMounted();
  const best = months.reduce((a, b) => (b.revenue > a.revenue ? b : a), months[0]!);
  const avg = won.length ? Math.round(sales.allTimeRevenue / won.length) : 0;
  const byService = SALE_SERVICES.map((s) => ({ s, sum: won.filter((p) => p.service === s).reduce((t, p) => t + p.amount, 0) })).filter((x) => x.sum > 0);

  const stats = [
    { icon: BadgeDollarSign, label: t("Oydagi sotuvlar"), value: <CountUp value={sales.revenue} format={(n) => usd(Math.round(n))} />, sub: t("{n} ta sotuv · plan davrida", { n: sales.count }) },
    { icon: Receipt, label: t("O'rtacha chek"), value: <CountUp value={avg} format={(n) => usd(Math.round(n))} />, sub: t("bitta sotuv uchun") },
    { icon: Trophy, label: t("Shu hafta"), value: <CountUp value={sales.weekRevenue} format={(n) => usd(Math.round(n))} />, sub: t("{n} ta sotuv", { n: sales.weekCount }) },
    { icon: Percent, label: t("Eng yaxshi oy"), value: best.revenue ? best.label : "—", sub: best.revenue ? usd(best.revenue) : t("hali sotuv yo'q") },
  ];

  return (
    <div className="grid gap-5">
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} data-tilt className="glass rounded-[22px] p-4">
            <div className="flex items-center justify-between">
              <span className="label">{s.label}</span>
              <s.icon size={15} className="text-3" />
            </div>
            <div className="tabular mt-2 text-[26px] leading-none font-semibold tracking-[-0.03em]">{s.value}</div>
            <div className="text-3 mt-1.5 text-[12px]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <GlassCard
          title={t("Oylar bo'yicha sotuvlar")}
          subtitle={t("Oxirgi 6 oy")}
          actions={
            <div className="glass-chip flex p-1">
              {(["revenue", "count"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  aria-pressed={metric === m}
                  className="rounded-full px-3 py-1 text-[12px] font-semibold transition-colors"
                  style={metric === m ? { background: "var(--tab-active-bg)", color: "var(--tab-active-text)" } : { color: "var(--text-2)" }}
                >
                  {m === "revenue" ? t("Summa") : t("Soni")}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid h-[240px] grid-cols-6 items-end gap-3 sm:gap-5">
            {months.map((mo) => {
              const v = mo[metric];
              const h = mounted ? Math.round((v / max) * 190) : 0;
              const current = mo.key === today().slice(0, 7);
              return (
                <div key={mo.key} className="flex h-full flex-col items-center justify-end gap-2">
                  <span className="tabular text-2 text-[11.5px] font-semibold">{v ? (metric === "revenue" ? usd(v) : v) : ""}</span>
                  <div
                    className="w-full max-w-12 rounded-t-[12px] rounded-b-[6px] transition-[height] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      height: Math.max(h, 4),
                      background: v
                        ? current
                          ? "linear-gradient(180deg, var(--accent-2), var(--accent))"
                          : "linear-gradient(180deg, color-mix(in srgb, var(--text) 35%, transparent), color-mix(in srgb, var(--text) 18%, transparent))"
                        : "var(--track)",
                      boxShadow: v ? "inset 0 1px 0 rgb(255 255 255 / 0.35)" : undefined,
                    }}
                  />
                  <span className={cn("text-[11.5px] font-semibold", current ? "" : "text-3")}>{mo.label}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard title={t("Konversiya")} subtitle={t("Sotildi ÷ (sotildi + rad etdi)")}>
          <div className="flex flex-col items-center gap-4">
            <ProgressRing value={sales.conversion ?? 0} size={150} stroke={12}>
              <div>
                <div className="tabular text-[32px] leading-none font-semibold">
                  <CountUp value={sales.conversion ?? 0} />%
                </div>
                <div className="text-3 mt-1 text-[11px]">{t("yutildi")}</div>
              </div>
            </ProgressRing>
            <dl className="w-full text-[13px]">
              {[
                [t("Sotildi"), won.length],
                [t("Rad etdi"), lost],
                [t("Ochiq"), prospects.filter((p) => p.outcome === "open").length],
              ].map(([k, v]) => (
                <div key={k} className="hairline flex justify-between border-b py-2 last:border-b-0">
                  <dt className="text-2">{k}</dt>
                  <dd className="tabular font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <GlassCard title={t("Xizmatlar bo'yicha")} subtitle={t("Jami {amount}", { amount: usd(sales.allTimeRevenue) })}>
          {byService.length === 0 && <p className="text-3 text-[13px]">{t("Hali sotuv yo'q")}</p>}
          <div className="flex flex-col gap-3.5">
            {byService.map(({ s, sum }) => (
              <div key={s}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span>{serviceLabel(s)}</span>
                  <span className="tabular font-semibold">{usd(sum)}</span>
                </div>
                <ProgressBar value={(sum / Math.max(1, sales.allTimeRevenue)) * 100} label={s} />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard title={t("Oxirgi sotuvlar")} subtitle={t("Mijozni Prospektlar bo'limida «Sotildi» deb belgilasangiz shu yerga tushadi")}>
          <ul className="flex flex-col">
            {won.length === 0 && <li className="text-3 py-6 text-center text-[13px]">{t("Hali sotuv yo'q")}</li>}
            {won.slice(0, 8).map((p) => (
              <li key={p.id} className="hairline flex items-center gap-3 border-b py-2.5 last:border-b-0">
                <span className="grid size-9 place-items-center rounded-full text-[12px] font-bold" style={{ background: "color-mix(in srgb, var(--green) 16%, transparent)", color: "var(--green)" }}>
                  <Trophy size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">
                    {p.firstName} {p.lastName}
                  </div>
                  <div className="text-3 truncate text-[12px]">
                    {p.service ? serviceLabel(p.service) : ""} · {p.niche}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular text-[14px] font-semibold" style={{ color: "var(--green)" }}>
                    +{usd(p.amount)}
                  </div>
                  <div className="text-3 text-[11.5px]">{formatDayMonth(p.wonAt!)}</div>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
