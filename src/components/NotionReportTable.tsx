"use client";

import { ClipboardCopy, Sheet, Table2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatNumeric, startOfWeek, today } from "@/lib/date";
import { STATUS_KEY, copyText, reportHeaders, reportsToMarkdown, reportsToTSV } from "@/lib/notion";
import { useT } from "@/locales";
import type { ReportStatus } from "@/lib/types";
import { useDashboard } from "@/store/useDashboard";
import { GlassCard, cn, toast } from "./ui";

const STATUS_TONE: Record<ReportStatus, string> = { done: "tone-green", partial: "tone-orange", missed: "tone-red" };

export function NotionReportTable() {
  const reports = useDashboard((s) => s.reports);
  const removeReport = useDashboard((s) => s.removeReport);
  const [onlyThisWeek, setOnlyThisWeek] = useState(false);

  const rows = useMemo(() => {
    const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
    if (!onlyThisWeek) return sorted;
    const monday = startOfWeek(today());
    return sorted.filter((r) => r.date >= monday);
  }, [reports, onlyThisWeek]);

  const totals = rows.reduce((t, r) => ({ p: t.p + r.proposals, c: t.c + r.calls }), { p: 0, c: 0 });
  const todayIso = today();
  const t = useT();

  async function copy(kind: "md" | "tsv") {
    const text = kind === "md" ? reportsToMarkdown(rows) : reportsToTSV(rows);
    if (await copyText(text)) {
      toast(kind === "md" ? t("{n} qator nusxalandi — Notionga joylang", { n: rows.length }) : t("{n} qator TSV ko'rinishida nusxalandi", { n: rows.length }));
    }
  }

  return (
    <GlassCard
      icon={Table2}
      iconTone="var(--text)"
      eyebrow={t("Notion · Hisobot jadvali")}
      title={t("Kunlik hisobotlar jadvali")}
      subtitle={t("Notion sahifasiga joylang — jadval avtomatik yaratiladi")}
      delay={300}
      actions={
        <>
          <button type="button" className={cn("btn h-8 px-3 text-[12px]", onlyThisWeek ? "btn-glass" : "text-2 hover:bg-[var(--track)]")} onClick={() => setOnlyThisWeek((v) => !v)} aria-pressed={onlyThisWeek}>
            {onlyThisWeek ? t("Shu hafta") : t("Barcha kunlar")}
          </button>
          <button type="button" className="btn btn-glass" onClick={() => copy("tsv")} disabled={!rows.length} title={t("Mavjud Notion bazasiga qator sifatida joylash uchun")}>
            <Sheet size={14} />
            TSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => copy("md")} disabled={!rows.length}>
            <ClipboardCopy size={15} />
            {t("Notion uchun nusxalash")}
          </button>
        </>
      }
    >
      <div className="glass-strong overflow-hidden p-0">
        <div className="max-h-[460px] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
            <thead className="sticky top-0 z-10" style={{ background: "var(--glass-bg-strong)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
              <tr className="hairline border-b">
                {reportHeaders().map((h, i) => (
                  <th key={h} scope="col" className={cn("label px-4 py-3", (i === 1 || i === 2) && "text-right")}>
                    {h}
                  </th>
                ))}
                <th className="w-10" aria-label={t("Amallar")} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-3 px-4 py-10 text-center">
                    {t("Hali hisobot yo'q — kun yakunida yuqoridagi formani to'ldiring")}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="group hairline border-b transition-colors last:border-b-0 hover:bg-[var(--track)]">
                  <td className="tabular px-4 py-3 font-medium whitespace-nowrap">
                    {formatNumeric(r.date)}
                    {r.date === todayIso && <span className="pill tone-accent ml-2 h-5 px-2">{t("bugun")}</span>}
                  </td>
                  <td className="tabular px-4 py-3 text-right font-semibold">{r.proposals}</td>
                  <td className="tabular px-4 py-3 text-right">{r.calls}</td>
                  <td className="text-2 max-w-[420px] px-4 py-3">
                    <span className="line-clamp-2" title={r.feedback}>
                      {r.feedback || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("pill", STATUS_TONE[r.status])}>{t(STATUS_KEY[r.status])}</span>
                  </td>
                  <td className="pr-3">
                    <button
                      type="button"
                      className="icon-btn size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={t("{date} hisobotini o'chirish", { date: formatNumeric(r.date) })}
                      onClick={() => removeReport(r.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="hairline border-t font-semibold">
                  <td className="px-4 py-3">{t("Jami · {n} kun", { n: rows.length })}</td>
                  <td className="tabular px-4 py-3 text-right">{totals.p}</td>
                  <td className="tabular px-4 py-3 text-right">{totals.c}</td>
                  <td className="text-2 px-4 py-3 font-normal" colSpan={3}>
                    {t("O'rtacha {n} taklif / kun", { n: (totals.p / rows.length).toFixed(1) })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </GlassCard>
  );
}
