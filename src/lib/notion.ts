import { formatNumeric } from "./date";
import { type TKey, getT } from "@/locales";
import type { DailyReport, FeedbackNote, NoteKind, ReportStatus } from "./types";

export const STATUS_KEY: Record<ReportStatus, TKey> = {
  done: "Bajarildi|status",
  partial: "Qisman",
  missed: "Bajarilmadi",
};

export const NOTE_KIND_KEY: Record<NoteKind, TKey> = {
  objection: "E'tiroz",
  interest: "Qiziqish bor",
  callback: "Qayta qo'ng'iroq",
  rejected: "Rad etdi",
};

/** Localized labels (current UI language). */
export const statusLabel = (s: ReportStatus) => getT()(STATUS_KEY[s]);
export const noteKindLabel = (k: NoteKind) => getT()(NOTE_KIND_KEY[k]);

const HEADER_KEYS: TKey[] = ["Sana", "Takliflar", "Qo'ng'iroqlar", "Mulohazalar", "Holat"];
export const reportHeaders = () => HEADER_KEYS.map((k) => getT()(k));

function oneLine(s: string): string {
  return s.replace(/\s*\n+\s*/g, " · ").trim();
}

function rows(reports: DailyReport[]): string[][] {
  return [...reports]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => [formatNumeric(r.date), String(r.proposals), String(r.calls), oneLine(r.feedback) || "—", statusLabel(r.status)]);
}

/** Markdown table — pasting it into Notion creates a table block. */
export function reportsToMarkdown(reports: DailyReport[]): string {
  const esc = (c: string) => c.replace(/\|/g, "\\|");
  const headers = reportHeaders();
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows(reports).map((r) => `| ${r.map(esc).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

/** Tab-separated rows — paste directly into existing Notion database rows. */
export function reportsToTSV(reports: DailyReport[], withHeader = true): string {
  const clean = (c: string) => c.replace(/\t/g, " ");
  const lines = rows(reports).map((r) => r.map(clean).join("\t"));
  return (withHeader ? [reportHeaders().join("\t"), ...lines] : lines).join("\n");
}

/** Bulleted list of feedback notes for a Notion "Mulohazalar" page. */
export function notesToMarkdown(notes: FeedbackNote[]): string {
  return [...notes]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((n) => `- **${formatNumeric(n.date)} · ${n.client}** (${n.niche}) — _${noteKindLabel(n.kind)}_: ${oneLine(n.text)}`)
    .join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers/contexts without async clipboard permission.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
