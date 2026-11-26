"use client";

import { Check, DollarSign, Hourglass, Mail, MessageCircle, Pencil, Phone, RotateCcw, Search, Send, Trash2, Trophy, UserPlus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDayMonth, today } from "@/lib/date";
import { type SalesStats, formatPhone, usd } from "@/lib/sales";
import { NOTE_KIND_KEY } from "@/lib/notion";
import { type TKey, getT, useT } from "@/locales";
import { type NoteKind, type Prospect, SALE_SERVICES, type SaleService } from "@/lib/types";
import { useDashboard } from "@/store/useDashboard";
import { GlassCard, cn, toast } from "./ui";
import { ContactDialog, channelLabel } from "./StageActions";
import { debtOf, stageOf } from "@/lib/pipeline";
import type { Stage } from "@/lib/types";
import { ContactLinks, InstagramIcon } from "./ContactLinks";
import { normalizeEmail, normalizeInstagram, normalizeTelegram, phoneDigitsOk } from "@/lib/contacts";
import { confettiFrom, withViewTransition } from "@/lib/motion";

/** "Boshqa" (Other) is the only service name that needs translating. */
export function serviceLabel(s: SaleService): string {
  return s === "Boshqa" ? getT()("Boshqa") : s;
}

export type Filter = "all" | Stage;

const FILTERS: { id: Filter; label: TKey }[] = [
  { id: "all", label: "Hammasi" },
  { id: "new", label: "Yangi" },
  { id: "contacted", label: "Bog'lanildi" },
  { id: "progress", label: "Jarayonda" },
  { id: "won", label: "Sotildi" },
  { id: "lost", label: "Rad etdi" },
];

const EMPTY = { firstName: "", lastName: "", phone: "", instagram: "", telegram: "", email: "", niche: "", note: "" };

export function ProspectForm({ editing, onDone }: { editing: Prospect | null; onDone: () => void }) {
  const addProspect = useDashboard((s) => s.addProspect);
  const updateProspect = useDashboard((s) => s.updateProspect);
  const t = useT();
  const [form, setForm] = useState(
    editing
      ? {
          firstName: editing.firstName,
          lastName: editing.lastName,
          phone: editing.phone,
          instagram: editing.instagram ? `@${editing.instagram}` : "",
          telegram: editing.telegram ? `@${editing.telegram}` : "",
          email: editing.email ?? "",
          niche: editing.niche,
          note: editing.note,
        }
      : EMPTY,
  );
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Each filled channel must be valid; at least one channel is required.
  const phoneOk = form.phone.trim() === "" || phoneDigitsOk(form.phone);
  const igOk = form.instagram.trim() === "" || normalizeInstagram(form.instagram) !== "";
  const tgOk = form.telegram.trim() === "" || normalizeTelegram(form.telegram) !== "";
  const emailOk = form.email.trim() === "" || normalizeEmail(form.email) !== "";
  const anyContact = [form.phone, form.instagram, form.telegram, form.email].some((v) => v.trim() !== "");
  const valid = form.firstName.trim() !== "" && anyContact && phoneOk && igOk && tgOk && emailOk;

  return (
    <div className="@container">
    <form
      className="glass-strong grid gap-2.5 p-4 @md:grid-cols-2 @4xl:grid-cols-[1fr_1fr_1.1fr_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        if (editing) {
          updateProspect(editing.id, form);
          toast(t("Mijoz ma'lumotlari yangilandi"));
          onDone();
        } else if (addProspect(form)) {
          toast(t("{name} ro'yxatga qo'shildi", { name: form.firstName }));
          setForm({ ...EMPTY, niche: form.niche });
        }
      }}
    >
      <input className="field" placeholder={t("Ism *")} value={form.firstName} maxLength={60} onChange={set("firstName")} aria-label={t("Ism")} required autoComplete="off" />
      <input className="field" placeholder={t("Familiya")} value={form.lastName} maxLength={60} onChange={set("lastName")} aria-label={t("Familiya")} autoComplete="off" />
      <input
        className="field"
        type="tel"
        inputMode="tel"
        placeholder={t("Telefon  90 123 45 67")}
        value={form.phone}
        maxLength={24}
        onChange={set("phone")}
        aria-label={t("Telefon raqami")}
        aria-invalid={!phoneOk}
        autoComplete="off"
      />
      <input className="field" placeholder={t("Nisha / kompaniya")} value={form.niche} maxLength={60} onChange={set("niche")} aria-label={t("Nisha")} autoComplete="off" />
      {(
        [
          ["instagram", InstagramIcon, t("Instagram (@username)"), igOk, "text"],
          ["telegram", Send, t("Telegram (@username)"), tgOk, "text"],
          ["email", Mail, t("Email"), emailOk, "email"],
        ] as const
      ).map(([key, Icon, label, ok, type]) => (
        <div key={key} className={cn("relative", key === "email" && "@md:col-span-2")}>
          <span className="text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            <Icon size={14} />
          </span>
          <input
            className="field pl-9"
            type={type}
            placeholder={label}
            aria-label={label}
            aria-invalid={!ok}
            value={form[key]}
            maxLength={key === "email" ? 254 : 80}
            onChange={set(key)}
            autoComplete="off"
            style={!ok ? { borderColor: "var(--red)" } : undefined}
          />
        </div>
      ))}
      <input
        className="field @md:col-span-2 @4xl:col-span-3"
        placeholder={t("Izoh (qayerdan topildi, kim u…)")}
        value={form.note}
        maxLength={500}
        onChange={set("note")}
        aria-label={t("Izoh")}
      />
      <div className="flex gap-2 @md:col-span-2 @4xl:col-span-1">
        {editing && (
          <button type="button" className="btn btn-glass h-10" onClick={onDone}>
            {t("Bekor")}
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary h-10 flex-1 text-[13.5px]"
          disabled={!valid}
          title={!valid ? t("Avval ism va kamida bitta aloqani kiriting") : undefined}
        >
          {editing ? <Check size={16} /> : <UserPlus size={16} />}
          {editing ? t("Saqlash") : t("Mijozni qo'shish")}
        </button>
      </div>
      {!editing && !anyContact && (
        <p className="text-3 text-[12px] @md:col-span-2 @4xl:col-span-4">{t("* Ism va kamida bitta aloqa majburiy: telefon, Instagram, Telegram yoki email")}</p>
      )}
      {[
        !phoneOk && t("Telefon raqami 7–15 ta raqamdan iborat bo'lishi kerak"),
        !igOk && t("Instagram noto'g'ri — masalan: @mijoz_nomi yoki havola"),
        !tgOk && t("Telegram noto'g'ri — masalan: @username yoki t.me/username"),
        !emailOk && t("Email noto'g'ri"),
      ]
        .filter(Boolean)
        .map((m) => (
          <p key={String(m)} className="text-[12px] @md:col-span-2 @4xl:col-span-4" style={{ color: "var(--red)" }}>
            {m}
          </p>
        ))}
    </form>
    </div>
  );
}

export function SaleForm({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const markWon = useDashboard((s) => s.markWon);
  const t = useT();
  const [amount, setAmount] = useState("");
  const [service, setService] = useState<SaleService>("Landing Page");
  // "Paid now" follows the total until the user types their own figure.
  const [paid, setPaid] = useState<string | null>(null);
  const value = Number(amount);
  const paidNow = paid === null ? value : Math.min(value, Number(paid) || 0);
  const owed = Math.max(0, value - paidNow);
  return (
    <form
      className="fade-in mt-3 flex flex-col gap-4 rounded-[20px] p-4"
      style={{ background: "color-mix(in srgb, var(--green) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--green) 22%, transparent)" }}
      onSubmit={(e) => {
        e.preventDefault();
        confettiFrom(e.currentTarget.querySelector("button[type=submit]"));
        withViewTransition(() => markWon(p.id, value, service, paidNow));
        toast(t("Sotuv yozildi: {amount} 🎉", { amount: usd(value) }));
        onClose();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="label">{t("Sotuv summasi ($)")}</span>
        <div className="relative">
          <DollarSign size={16} className="text-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
          <input
            className="field tabular h-11 pl-9 text-[16px] font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            type="number"
            inputMode="decimal"
            min={1}
            max={10000000}
            placeholder="500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={t("Sotuv summasi, dollar")}
            autoFocus
            required
          />
        </div>
      </label>

      <label className="flex flex-col gap-2">
        <span className="label">{t("Hozir to'langan ($)")}</span>
        <div className="relative">
          <DollarSign size={16} className="text-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
          <input
            className="field tabular h-11 pl-9 text-[16px] font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            type="number"
            inputMode="decimal"
            min={0}
            max={value || undefined}
            placeholder="0"
            value={paid === null ? amount : paid}
            onChange={(e) => setPaid(e.target.value)}
            aria-label={t("Hozir to'langan ($)")}
          />
        </div>
        <span className="text-[12px] font-semibold" style={{ color: owed > 0 ? "var(--orange)" : "var(--green)" }}>
          {value > 0 && (owed > 0 ? t("Qolgani qarzga yoziladi: {amount}", { amount: usd(owed) }) : t("To'liq to'landi"))}
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="label">{t("Xizmat turi")}</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Xizmat turi")}>
          {SALE_SERVICES.map((s) => {
            const active = service === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setService(s)}
                className={cn("btn h-8 px-3.5 text-[12.5px]", !active && "btn-glass")}
                style={active ? { background: "var(--tab-active-bg)", color: "var(--tab-active-text)" } : undefined}
              >
                {active && <Check size={13} strokeWidth={3} />}
                {serviceLabel(s)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn btn-glass" onClick={onClose}>
          {t("Bekor qilish")}
        </button>
        <button type="submit" className="btn flex-1 text-white" style={{ background: "var(--green)" }} disabled={!(value > 0)}>
          <Check size={15} strokeWidth={3} />
          {value > 0 ? t("{amount} — sotuvni saqlash", { amount: usd(value) }) : t("Summani kiriting")}
        </button>
      </div>
    </form>
  );
}

export function CallNoteForm({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const addNote = useDashboard((s) => s.addNote);
  const t = useT();
  const [kind, setKind] = useState<NoteKind>("interest");
  const [text, setText] = useState("");
  return (
    <form
      className="fade-in mt-3 flex flex-col gap-2 rounded-2xl p-3"
      style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)" }}
      onSubmit={(e) => {
        e.preventDefault();
        addNote({ date: today(), client: `${p.firstName} ${p.lastName}`.trim(), niche: p.niche, kind, text });
        toast(t("Mulohaza saqlandi"));
        onClose();
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(NOTE_KIND_KEY) as NoteKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={cn("pill h-7 cursor-pointer px-3 text-[12px]", kind === k ? "tone-accent" : "opacity-60")}
          >
            {t(NOTE_KIND_KEY[k])}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="field" placeholder={t("Qo'ng'iroqda nima dedi?")} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} aria-label={t("Mulohaza")} autoFocus required />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          {t("Saqlash")}
        </button>
        <button type="button" className="icon-btn" aria-label={t("Yopish")} onClick={onClose}>
          <X size={15} />
        </button>
      </div>
    </form>
  );
}

function StepButton({ done, onClick, icon: Icon, label, doneLabel }: { done: boolean; onClick: () => void; icon: typeof Send; label: string; doneLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={done}
      className={cn("btn h-8 px-3 text-[12px]", done ? "" : "btn-glass")}
      style={done ? { background: "color-mix(in srgb, var(--green) 16%, transparent)", color: "var(--green)", border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)" } : undefined}
    >
      {done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
      {done ? doneLabel : label}
    </button>
  );
}

function ProspectRow({ p, onEdit }: { p: Prospect; onEdit: () => void }) {
  const markInProgress = useDashboard((s) => s.markInProgress);
  const markLost = useDashboard((s) => s.markLost);
  const reopen = useDashboard((s) => s.reopenProspect);
  const remove = useDashboard((s) => s.removeProspect);
  const t = useT();
  const [panel, setPanel] = useState<"none" | "sale" | "note">("none");
  const [contacting, setContacting] = useState(false);
  const stage = stageOf(p);
  const debt = debtOf(p);
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
  const closed = p.outcome !== "open";

  return (
    <li className="glass-strong group p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="grid size-10 flex-none place-items-center rounded-full text-[13px] font-bold text-white"
          style={{
            background:
              p.outcome === "won" ? "var(--green)" : p.outcome === "lost" ? "var(--text-3)" : "linear-gradient(140deg, var(--accent), var(--purple))",
          }}
        >
          {initials || "?"}
        </span>
        <div className="min-w-[150px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">
              {p.firstName} {p.lastName}
            </span>
            {p.outcome === "won" && (
              <span className="pill tone-green">
                <Trophy size={11} /> {t("Sotildi")} · {usd(p.amount)}
              </span>
            )}
            {debt > 0 && <span className="pill tone-orange">{t("Qarz: {amount}", { amount: usd(debt) })}</span>}
            {stage === "contacted" && <span className="pill tone-accent">{t("Bog'lanildi")}</span>}
            {stage === "progress" && <span className="pill tone-purple">{t("Jarayonda")}</span>}
            {p.outcome === "lost" && <span className="pill tone-red">{t("Rad etdi")}</span>}
          </div>
          <div className="text-2 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px]">
            <ContactLinks p={p} />
            {p.niche && <span>{p.niche}</span>}
            {p.service && <span>{serviceLabel(p.service)}</span>}
            <span className="text-3">{t("qo'shildi {date}", { date: formatDayMonth(p.createdAt) })}</span>
          </div>
          {p.note && <p className="text-3 mt-1 text-[12.5px]">{p.note}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {p.phone && (
            <a href={`tel:${p.phone}`} className="btn btn-glass h-8 px-3 text-[12px]" aria-label={t("{name}ga qo'ng'iroq qilish", { name: p.firstName })}>
              <Phone size={14} />
              {t("Qo'ng'iroq")}
            </a>
          )}
          {!closed && (
            <>
              <StepButton
                done={stage !== "new"}
                onClick={() => (stage === "new" ? setContacting(true) : setPanel("note"))}
                icon={MessageCircle}
                label={t("Bog'landim")}
                doneLabel={p.contactChannel ? channelLabel(p.contactChannel, t) : t("Bog'lanildi")}
              />
              <StepButton
                done={stage === "progress"}
                onClick={() => stage !== "progress" && withViewTransition(() => markInProgress(p.id))}
                icon={Hourglass}
                label={t("Jarayonga")}
                doneLabel={t("Jarayonda")}
              />
              <button type="button" className="btn h-8 px-3 text-[12px] text-white" style={{ background: "var(--green)" }} onClick={() => setPanel("sale")}>
                <Trophy size={14} />
                {t("Sotildi")}
              </button>
              <button type="button" className="btn btn-glass h-8 px-3 text-[12px]" onClick={() => markLost(p.id)}>
                {t("Rad etdi")}
              </button>
            </>
          )}
          {closed && (
            <button type="button" className="btn btn-glass h-8 px-3 text-[12px]" onClick={() => reopen(p.id)} title={t("Holatni qaytarish")}>
              <RotateCcw size={13} />
              {t("Qayta ochish")}
            </button>
          )}
          <button type="button" className="icon-btn size-8" aria-label={t("Tahrirlash")} onClick={onEdit}>
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="icon-btn size-8"
            aria-label={t("O'chirish")}
            onClick={() => {
              if (confirm(t("{name} ro'yxatdan o'chirilsinmi?", { name: `${p.firstName} ${p.lastName}`.trim() }))) remove(p.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {panel === "sale" && <SaleForm p={p} onClose={() => setPanel("none")} />}
      <ContactDialog prospect={contacting ? p : null} onClose={() => setContacting(false)} />
      {panel === "note" && <CallNoteForm p={p} onClose={() => setPanel("none")} />}
    </li>
  );
}

export function Prospects({ sales }: { sales: SalesStats }) {
  const prospects = useDashboard((s) => s.prospects);
  const [filter, setFilter] = useState<Filter>("all");
  const t = useT();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = prospects.find((p) => p.id === editingId) ?? null;

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: prospects.length, new: 0, contacted: 0, progress: 0, won: 0, lost: 0 };
    for (const p of prospects) c[stageOf(p)]++;
    return c;
  }, [prospects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return prospects.filter((p) => {
      if (filter !== "all" && stageOf(p) !== filter) return false;
      if (!q) return true;
      return (
        `${p.firstName} ${p.lastName} ${p.niche} ${p.instagram ?? ""} ${p.telegram ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q.replace(/^@/, "")) ||
        (qDigits.length >= 3 && p.phone.includes(qDigits))
      );
    });
  }, [prospects, filter, query]);

  return (
    <GlassCard
      icon={Users}
      iconTone="var(--accent)"
      eyebrow={t("Topilgan mijozlar")}
      title={t("Prospektlar va sotuvlar")}
      subtitle={t("Ism, aloqa → bog'lanildi → jarayonda → sotildi")}
      delay={150}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("Bugun bog'lanish"), value: sales.contactedToday, tone: "var(--accent)" },
          { label: t("Jarayonda|stat"), value: sales.inProgress, tone: "var(--purple)" },
          { label: t("Bog'lanish kutmoqda"), value: sales.waitingContact, tone: "var(--orange)" },
          { label: t("Oydagi sotuvlar"), value: `${sales.count} · ${usd(sales.revenue)}`, tone: "var(--green)" },
        ].map((s) => (
          <div key={s.label} className="glass-strong p-3.5">
            <div className="label">{s.label}</div>
            <div className="tabular mt-1 text-[22px] font-semibold tracking-[-0.02em]" style={{ color: s.tone }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {editing ? <ProspectForm key={editing.id} editing={editing} onDone={() => setEditingId(null)} /> : <ProspectForm key="new" editing={null} onDone={() => undefined} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-1.5" role="tablist" aria-label={t("Holat bo'yicha filtr")}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn("btn h-7 px-3 text-[12px]", filter === f.id ? "btn-glass" : "text-2 hover:bg-[var(--track)]")}
            >
              {t(f.label)} · {counts[f.id]}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <Search size={14} className="text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
          <input className="field h-8 py-0 pl-8 text-[13px]" placeholder={t("Ism yoki raqam…")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("Qidirish")} />
        </div>
      </div>

      <ul className="mt-3 flex max-h-[640px] flex-col gap-2 overflow-y-auto pr-1">
        {visible.length === 0 && (
          <li className="text-3 py-10 text-center text-[13px]">
            {prospects.length === 0 ? t("Hali mijoz yo'q — yuqoridagi formaga ism va telefon kiriting") : t("Bu filtrda mijoz yo'q")}
          </li>
        )}
        {visible.map((p) => (
          <ProspectRow key={p.id} p={p} onEdit={() => setEditingId(p.id)} />
        ))}
      </ul>
    </GlassCard>
  );
}
