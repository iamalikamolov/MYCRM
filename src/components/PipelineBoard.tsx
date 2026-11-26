"use client";

import { ArrowRight, Check, Hourglass, MessageCircle, RotateCcw, Trophy, X } from "lucide-react";
import { useState } from "react";
import { formatDayMonth } from "@/lib/date";
import { withViewTransition } from "@/lib/motion";
import { contactedOn, debtOf, stageOf } from "@/lib/pipeline";
import { usd } from "@/lib/sales";
import type { Prospect, Stage } from "@/lib/types";
import { type TKey, useT } from "@/locales";
import { useDashboard } from "@/store/useDashboard";
import { ContactLinks } from "./ContactLinks";
import { SaleForm } from "./Prospects";
import { Modal } from "./SettingsSheet";
import { ChannelBadgeIcon, ContactDialog, channelLabel } from "./StageActions";
import { cn, toast } from "./ui";

const COLUMNS: { id: Stage; title: TKey; tone: string; hint?: TKey }[] = [
  { id: "new", title: "Yangi", tone: "var(--text-3)" },
  { id: "contacted", title: "Bog'lanildi", tone: "var(--accent)" },
  { id: "progress", title: "Jarayonda", tone: "var(--purple)", hint: "Loyiha mijozda sinovda — pul hali olinmagan" },
  { id: "won", title: "Sotildi", tone: "var(--green)" },
  { id: "lost", title: "Rad etdi", tone: "var(--red)" },
];

const NEXT: Partial<Record<Stage, { label: TKey; icon: typeof Trophy }>> = {
  new: { label: "Bog'landim", icon: MessageCircle },
  contacted: { label: "Jarayonga", icon: Hourglass },
  progress: { label: "Sotildi", icon: Trophy },
};

function Card({ p, onContact, onWon }: { p: Prospect; onContact: (p: Prospect) => void; onWon: (p: Prospect) => void }) {
  const move = useDashboard((s) => s.moveProspect);
  const markInProgress = useDashboard((s) => s.markInProgress);
  const t = useT();
  const stage = stageOf(p);
  const next = NEXT[stage];
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
  const debt = debtOf(p);
  const reached = contactedOn(p);

  function goNext() {
    if (stage === "new") return onContact(p);
    if (stage === "contacted") {
      withViewTransition(() => markInProgress(p.id));
      return toast(t("{name}: jarayonda", { name: p.firstName }));
    }
    if (stage === "progress") onWon(p);
  }

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/prospect", p.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="glass-strong group cursor-grab p-3 transition-transform duration-200 hover:-translate-y-0.5 active:cursor-grabbing"
      style={{ viewTransitionName: `p-${p.id}` }}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold">
            {p.firstName} {p.lastName}
          </div>
          <div className="text-3 truncate text-[12px]">{p.niche || "—"}</div>
        </div>
        <span className="grid size-7 flex-none place-items-center rounded-full text-[11px] font-bold" style={{ background: "var(--track)", color: "var(--text-2)" }}>
          {initials}
        </span>
      </div>

      {p.outcome === "won" ? (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="tabular text-[13px] font-semibold" style={{ color: "var(--green)" }}>
            {usd(p.amount)}
          </span>
          {debt > 0 ? (
            <span className="pill tone-orange">{t("Qarz: {amount}", { amount: usd(debt) })}</span>
          ) : (
            p.service && <span className="text-3 truncate text-[11px]">{p.service}</span>
          )}
        </div>
      ) : (
        <ContactLinks p={p} limit={3} className="mt-2.5 text-[12px]" />
      )}

      {(stage === "contacted" || stage === "progress") && reached && (
        <div className="text-3 mt-1.5 flex items-center gap-1.5 text-[11.5px]">
          {p.contactChannel && <ChannelBadgeIcon channel={p.contactChannel} />}
          {p.contactChannel ? t("{channel} orqali · {date}", { channel: channelLabel(p.contactChannel, t), date: formatDayMonth(reached) }) : formatDayMonth(reached)}
        </div>
      )}

      {next && (
        <div className="mt-2.5 flex gap-1.5">
          <button type="button" className="btn btn-glass h-7 min-w-0 flex-1 px-2 text-[11.5px]" onClick={goNext}>
            <next.icon size={12} />
            <span className="truncate">{t(next.label)}</span>
            <ArrowRight size={12} className="ml-auto flex-none opacity-60" />
          </button>
          <button
            type="button"
            className="btn h-7 flex-none px-2 text-[11.5px]"
            style={{ background: "color-mix(in srgb, var(--red) 14%, transparent)", color: "var(--red)" }}
            title={t("Rad etdi")}
            aria-label={t("{name}: rad etdi", { name: p.firstName })}
            onClick={() => {
              withViewTransition(() => move(p.id, "lost"));
              toast(t("{name} «Rad etdi» bo'limiga o'tdi", { name: p.firstName }));
            }}
          >
            <X size={13} strokeWidth={2.6} />
            {t("Rad")}
          </button>
        </div>
      )}
      {stage === "lost" && (
        <button
          type="button"
          className="btn btn-glass mt-2.5 h-7 w-full px-2 text-[11.5px]"
          onClick={() => {
            withViewTransition(() => move(p.id, p.inProgressAt ? "progress" : "new"));
            toast(t("{name} qayta ochildi", { name: p.firstName }));
          }}
        >
          <RotateCcw size={12} />
          {t("Qayta ochish")}
        </button>
      )}
    </li>
  );
}

export function PipelineBoard() {
  const prospects = useDashboard((s) => s.prospects);
  const move = useDashboard((s) => s.moveProspect);
  const t = useT();
  const [over, setOver] = useState<Stage | null>(null);
  const [winning, setWinning] = useState<Prospect | null>(null);
  const [contacting, setContacting] = useState<Prospect | null>(null);

  function drop(stage: Stage, id: string) {
    const p = prospects.find((x) => x.id === id);
    if (!p || stageOf(p) === stage) return;
    if (stage === "won") return setWinning(p);
    if (stage === "contacted") return setContacting(p);
    withViewTransition(() => move(id, stage));
  }

  return (
    <>
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[1060px] grid-cols-5 gap-3">
          {COLUMNS.map((col) => {
            const items = prospects.filter((p) => stageOf(p) === col.id);
            const sum = items.reduce((s, p) => s + p.amount, 0);
            return (
              <section
                key={col.id}
                aria-label={t(col.title)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(col.id);
                }}
                onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  drop(col.id, e.dataTransfer.getData("text/prospect"));
                }}
                className={cn("glass flex min-h-[420px] flex-col rounded-[22px] p-3 transition-shadow", over === col.id && "ring-2")}
                style={over === col.id ? ({ "--tw-ring-color": col.tone } as React.CSSProperties) : undefined}
              >
                <header className="mb-3 px-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: col.tone }} />
                      <span className="text-[13px] font-semibold">{t(col.title)}</span>
                      <span className="text-3 tabular text-[12px]">{items.length}</span>
                    </div>
                    {col.id === "won" && (
                      <span className="tabular text-[12px] font-semibold" style={{ color: "var(--green)" }}>
                        {usd(sum)}
                      </span>
                    )}
                  </div>
                  {col.hint && <p className="text-3 mt-1 text-[11px] leading-snug">{t(col.hint)}</p>}
                </header>
                <ul className="flex flex-1 flex-col gap-2">
                  {items.map((p) => (
                    <Card key={p.id} p={p} onContact={setContacting} onWon={setWinning} />
                  ))}
                  {items.length === 0 && (
                    <li className="text-3 grid flex-1 place-items-center rounded-2xl border border-dashed text-center text-[12px]" style={{ borderColor: "var(--hairline)" }}>
                      {t("Shu yerga sudrab tashlang")}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <ContactDialog prospect={contacting} onClose={() => setContacting(null)} />
      <Modal
        open={!!winning}
        onClose={() => setWinning(null)}
        title={winning ? t("Sotuv: {name}", { name: `${winning.firstName} ${winning.lastName}`.trim() }) : ""}
        icon={Check}
      >
        {winning && <SaleForm p={winning} onClose={() => setWinning(null)} />}
      </Modal>
    </>
  );
}
