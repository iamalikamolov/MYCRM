"use client";

import { ClipboardPen, Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLong, today } from "@/lib/date";
import { NOTE_KIND_KEY, STATUS_KEY } from "@/lib/notion";
import { useT } from "@/locales";
import { autoStatus } from "@/lib/plan";
import type { ReportStatus } from "@/lib/types";
import { useDashboard } from "@/store/useDashboard";
import { GlassCard, Stepper, cn, toast } from "./ui";

const STATUS_TONE: Record<ReportStatus, string> = { done: "tone-green", partial: "tone-orange", missed: "tone-red" };

export function DailyReportForm({ dailyQuota }: { dailyQuota: number }) {
  const reports = useDashboard((s) => s.reports);
  const notes = useDashboard((s) => s.notes);
  const saveReport = useDashboard((s) => s.saveReport);
  const prospects = useDashboard((s) => s.prospects);
  const t = useT();

  const [date, setDate] = useState(today());
  const [proposals, setProposals] = useState(0);
  const [calls, setCalls] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [summary, setSummary] = useState("");
  const [statusMode, setStatusMode] = useState<"auto" | ReportStatus>("auto");

  // Picking a date that already has a report loads it for editing.
  const existing = reports.find((r) => r.date === date);
  useEffect(() => {
    if (existing) {
      setProposals(existing.proposals);
      setCalls(existing.calls);
      setFeedback(existing.feedback);
      setSummary(existing.summary);
      setStatusMode(existing.status === autoStatus(existing.proposals, dailyQuota) ? "auto" : existing.status);
    } else {
      setProposals(0);
      setCalls(0);
      setFeedback("");
      setSummary("");
      setStatusMode("auto");
    }
    // Only reload when the selected day changes, not on every store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const status: ReportStatus = statusMode === "auto" ? autoStatus(proposals, dailyQuota) : statusMode;
  const dayNotes = notes.filter((n) => n.date === date);
  const dayProposals = prospects.filter((p) => p.proposalAt === date).length;
  const dayCalls = prospects.filter((p) => p.calledAt === date).length;

  function fillFromNotes() {
    const text = dayNotes.map((n) => `${n.client} — ${t(NOTE_KIND_KEY[n.kind]).toLowerCase()}: ${n.text}`).join("\n");
    setFeedback((f) => (f.trim() ? `${f.trim()}\n${text}` : text));
  }

  return (
    <GlassCard
      icon={ClipboardPen}
      iconTone="var(--orange)"
      eyebrow={t("Kun yakuni")}
      title={t("Kunlik Hisobot")}
      subtitle={existing ? t("{date} — mavjud hisobot tahrirlanmoqda", { date: formatLong(date) }) : formatLong(date)}
      delay={180}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const replaced = saveReport({ date, proposals, calls, feedback, summary, status });
          toast(replaced ? t("Hisobot yangilandi") : t("Hisobot jadvalga qo'shildi"));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="label">{t("Sana")}</span>
            <input type="date" className="field" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} required />
          </label>
          <div className="flex flex-col gap-2">
            <span className="label">{t("Takliflar yuborildi")}</span>
            <Stepper label={t("Yuborilgan takliflar")} value={proposals} onChange={setProposals} max={999} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="label">{t("Qo'ng'iroqlar")}</span>
            <Stepper label={t("Qilingan qo'ng'iroqlar")} value={calls} onChange={setCalls} max={999} />
          </div>
        </div>

        {(dayProposals > 0 || dayCalls > 0) && (
          <button
            type="button"
            className="glass-strong flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left text-[12.5px]"
            onClick={() => {
              setProposals(dayProposals);
              setCalls(dayCalls);
            }}
          >
            <Sparkles size={14} style={{ color: "var(--accent)" }} />
            <span>
              {t("Prospektlar bo'yicha shu kuni: {p} ta taklif, {c} ta qo'ng'iroq.", { p: dayProposals, c: dayCalls })}{" "}
              <span style={{ color: "var(--accent)" }} className="font-semibold">
                {t("Raqamlarni to'ldirish")}
              </span>
            </span>
          </button>
        )}

        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between">
            <span className="label">{t("Mulohazalar · e'tirozlar (Notion)")}</span>
            {dayNotes.length > 0 && (
              <button type="button" className="text-[12px] font-semibold" style={{ color: "var(--accent)" }} onClick={fillFromNotes}>
                <Sparkles size={12} className="mr-1 inline" />
                {t("{n} ta mulohazadan to'ldirish", { n: dayNotes.length })}
              </button>
            )}
          </span>
          <textarea
            className="field"
            rows={3}
            maxLength={2000}
            placeholder={t("Mijozlar nima dedi? Qanday e'tirozlar bo'ldi?")}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="label">{t("Kun xulosasi")}</span>
          <textarea
            className="field"
            rows={2}
            maxLength={2000}
            placeholder={t("Nima yaxshi ketdi, ertaga nimani o'zgartirasiz?")}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t("Holat")}>
            <span className="label mr-1">{t("Holat")}</span>
            {(["auto", "done", "partial", "missed"] as const).map((m) => {
              const active = statusMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStatusMode(m)}
                  className={cn("pill h-7 cursor-pointer px-3 text-[12px] transition-all", m !== "auto" && STATUS_TONE[m], !active && "opacity-55 hover:opacity-90")}
                  style={active ? { boxShadow: "0 0 0 2px var(--tone, var(--text-3))" } : undefined}
                >
                  {m === "auto" ? t("Avto · {s}", { s: t(STATUS_KEY[autoStatus(proposals, dailyQuota)]) }) : t(STATUS_KEY[m])}
                </button>
              );
            })}
          </div>
          <button type="submit" className="btn btn-primary">
            <Save size={15} />
            {existing ? t("Hisobotni yangilash") : t("Hisobotni saqlash")}
          </button>
        </div>
        <p className="text-3 -mt-1 text-[12px]">
          {t("Kunlik kvota: {n} ta taklif. Avto holat: kvota bajarilsa — «Bajarildi», yarmi — «Qisman».", { n: dailyQuota })}
        </p>
      </form>
    </GlassCard>
  );
}
