"use client";

import { CheckCheck, Copy, MessagesSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatDayMonth, today } from "@/lib/date";
import { NOTE_KIND_KEY, copyText, notesToMarkdown } from "@/lib/notion";
import { useT } from "@/locales";
import type { NoteKind } from "@/lib/types";
import { useDashboard } from "@/store/useDashboard";
import { GlassCard, cn, toast } from "./ui";

const KIND_TONE: Record<NoteKind, string> = {
  interest: "tone-green",
  objection: "tone-orange",
  callback: "tone-accent",
  rejected: "tone-red",
};
const KINDS = Object.keys(NOTE_KIND_KEY) as NoteKind[];
type Filter = "all" | "pending" | NoteKind;

export function FeedbackNotes() {
  const notes = useDashboard((s) => s.notes);
  const addNote = useDashboard((s) => s.addNote);
  const toggleSynced = useDashboard((s) => s.toggleNoteSynced);
  const markSynced = useDashboard((s) => s.markNotesSynced);
  const removeNote = useDashboard((s) => s.removeNote);
  const t = useT();

  const [client, setClient] = useState("");
  const [niche, setNiche] = useState("");
  const [kind, setKind] = useState<NoteKind>("interest");
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const pending = notes.filter((n) => !n.syncedToNotion);
  const visible = notes.filter((n) => (filter === "all" ? true : filter === "pending" ? !n.syncedToNotion : n.kind === filter));

  async function copyPending() {
    if (!pending.length) return;
    if (await copyText(notesToMarkdown(pending))) {
      markSynced(pending.map((n) => n.id));
      toast(t("{n} ta mulohaza nusxalandi — Notionga joylang", { n: pending.length }));
    }
  }

  return (
    <GlassCard
      icon={MessagesSquare}
      iconTone="var(--accent)"
      eyebrow={t("Notion · Mulohazalar")}
      title={t("Qo'ng'iroq mulohazalari")}
      subtitle={t("{n} ta mulohaza hali Notionga yozilmagan", { n: pending.length })}
      delay={240}
      actions={
        <button type="button" className="btn btn-glass" onClick={copyPending} disabled={!pending.length}>
          <Copy size={14} />
          {t("Yangilarini nusxalash")}
        </button>
      }
    >
      <form
        className="glass-strong flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          addNote({ date: today(), client, niche, kind, text });
          setClient("");
          setText("");
          toast(t("Mulohaza qo'shildi"));
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="field" placeholder={t("Mijoz / kompaniya")} value={client} maxLength={80} onChange={(e) => setClient(e.target.value)} aria-label={t("Mijoz")} required />
          <input
            className="field"
            placeholder={t("Nisha")}
            value={niche}
            maxLength={60}
            onChange={(e) => setNiche(e.target.value)}
            aria-label={t("Nisha")}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Mulohaza turi")}>
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn("pill h-7 cursor-pointer px-3 text-[12px] transition-all", KIND_TONE[k], kind !== k && "opacity-50 hover:opacity-90")}
              style={kind === k ? { boxShadow: "0 0 0 2px var(--tone)" } : undefined}
            >
              {t(NOTE_KIND_KEY[k])}
            </button>
          ))}
        </div>
        <textarea
          className="field"
          rows={2}
          maxLength={1000}
          placeholder={t("Mijoz nima dedi? Keyingi qadam?")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t("Mulohaza matni")}
          required
        />
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={!client.trim() || !text.trim()}>
            <Plus size={15} />
            {t("Mulohaza qo'shish")}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label={t("Filtr")}>
        {(["all", "pending", ...KINDS] as Filter[]).map((f) => {
          const active = filter === f;
          const label = f === "all" ? t("Hammasi · {n}", { n: notes.length }) : f === "pending" ? t("Notionga yozilmagan · {n}", { n: pending.length }) : t(NOTE_KIND_KEY[f]);
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={cn("btn h-7 px-3 text-[12px]", active ? "btn-glass" : "text-2 hover:bg-[var(--track)]")}
            >
              {label}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
        {visible.length === 0 && <li className="text-3 py-8 text-center text-[13px]">{t("Bu filtrda mulohaza yo'q")}</li>}
        {visible.map((n) => (
          <li key={n.id} className="glass-strong group p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold">{n.client}</span>
              <span className="text-3 text-[12px]">· {n.niche}</span>
              <span className={cn("pill", KIND_TONE[n.kind])}>{t(NOTE_KIND_KEY[n.kind])}</span>
              <span className="text-3 ml-auto text-[12px]">{formatDayMonth(n.date)}</span>
            </div>
            <p className="text-2 mt-1.5 text-[13.5px] leading-relaxed">{n.text}</p>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => toggleSynced(n.id)}
                className={cn("pill h-6 cursor-pointer", n.syncedToNotion ? "tone-green" : "")}
                aria-pressed={n.syncedToNotion}
              >
                {n.syncedToNotion ? <CheckCheck size={12} /> : null}
                {n.syncedToNotion ? t("Notionga yozildi") : t("Notionga yozilmagan")}
              </button>
              <button
                type="button"
                className="icon-btn size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={t("{name} mulohazasini o'chirish", { name: n.client })}
                onClick={() => removeNote(n.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
