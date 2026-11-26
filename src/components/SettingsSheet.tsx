"use client";

import { Check, Eraser, KeyRound, Languages, Lock, RotateCcw, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PASSWORD_MIN, changePassword } from "@/lib/vault";
import { useAuth } from "@/store/useAuth";
import { type ClearOptions, useDashboard } from "@/store/useDashboard";
import { PasswordInput } from "./AuthGate";
import { BackupSection } from "./BackupSection";
import { LANGS, LANG_NAMES, type TKey, useLang, useT } from "@/locales";
import { CheckButton, toast } from "./ui";

const AUTO_LOCK_OPTIONS = [5, 15, 30, 60, 0] as const;

export function Modal({ open, onClose, title, icon: Icon, children }: { open: boolean; onClose: () => void; title: string; icon: typeof Settings; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const t = useT();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="backdrop-in fixed inset-0 cursor-default bg-black/40 backdrop-blur-[3px]" aria-label={t("Yopish")} onClick={onClose} />
      <div className="glass modal-in relative my-auto w-full max-w-[520px] p-6">
        <header className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl" style={{ background: "var(--track)" }}>
            <Icon size={18} />
          </span>
          <h2 className="flex-1 text-[18px] font-semibold tracking-[-0.015em]">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("Yopish")}>
            <X size={17} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT();

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (next.length < PASSWORD_MIN) return setError(t("Yangi parol kamida {n} ta belgi", { n: PASSWORD_MIN }));
        if (next !== next2) return setError(t("Yangi parollar bir xil emas"));
        if (next === current) return setError(t("Yangi parol eskisidan farq qilsin"));
        setBusy(true);
        let ok = false;
        try {
          ok = await changePassword(current, next);
        } catch {
          setBusy(false);
          return setError(t("Serverda xatolik. Birozdan keyin qayta urining."));
        }
        setBusy(false);
        if (!ok) return setError(t("Joriy parol noto'g'ri"));
        setCurrent("");
        setNext("");
        setNext2("");
        toast(t("Parol o'zgartirildi"));
      }}
    >
      <PasswordInput value={current} onChange={setCurrent} placeholder={t("Joriy parol")} autoComplete="current-password" label={t("Joriy parol")} />
      <PasswordInput value={next} onChange={setNext} placeholder={t("Yangi parol (kamida {n} belgi)", { n: PASSWORD_MIN })} autoComplete="new-password" label={t("Yangi parol")} />
      <PasswordInput value={next2} onChange={setNext2} placeholder={t("Yangi parolni takrorlang")} autoComplete="new-password" label={t("Yangi parolni takrorlang")} />
      {error && (
        <p className="text-[13px]" role="alert" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary self-start" disabled={busy || !current || !next || !next2}>
        <KeyRound size={15} />
        {busy ? t("Saqlanmoqda…") : t("Parolni o'zgartirish")}
      </button>
    </form>
  );
}

const CLEAR_ITEMS: { key: keyof ClearOptions; title: TKey; hint: TKey }[] = [
  { key: "prospects", title: "Mijozlar va sotuvlar", hint: "Barcha mijozlar, qo'ng'iroq belgilari va sotuv summalari → 0" },
  { key: "reports", title: "Kunlik hisobotlar", hint: "Yuborilgan takliflar va qo'ng'iroqlar soni, Notion jadvali → 0" },
  { key: "notes", title: "Mulohazalar", hint: "Qo'ng'iroqdan keyingi yozuvlar" },
  { key: "restartPlan", title: "1 oylik planni shu haftadan boshlash", hint: "Plan shu dushanbadan, belgilangan vazifalar tozalanadi" },
];

function ResetToZero() {
  const clearData = useDashboard((s) => s.clearData);
  const prospects = useDashboard((s) => s.prospects.length);
  const reports = useDashboard((s) => s.reports.length);
  const notes = useDashboard((s) => s.notes.length);
  const counts = { prospects, reports, notes };
  const [sel, setSel] = useState<ClearOptions>({ prospects: true, reports: true, notes: true, restartPlan: true });
  const any = Object.values(sel).some(Boolean);
  const t = useT();

  return (
    <div className="flex flex-col gap-2">
      {CLEAR_ITEMS.map((it) => (
        <label key={it.key} className="flex cursor-pointer items-start gap-3 rounded-2xl px-2 py-1.5 hover:bg-[var(--track)]">
          <span className="pt-0.5">
            <CheckButton checked={sel[it.key]} onChange={() => setSel((s) => ({ ...s, [it.key]: !s[it.key] }))} label={t(it.title)} />
          </span>
          <span className="flex-1">
            <span className="block text-[14px] font-semibold">
              {t(it.title)}
              {it.key !== "restartPlan" && <span className="text-3 tabular ml-1.5 font-normal">{t("({n} ta)", { n: counts[it.key] })}</span>}
            </span>
            <span className="text-3 block text-[12px]">{t(it.hint)}</span>
          </span>
        </label>
      ))}
      <button
        type="button"
        className="btn mt-1 self-start text-white"
        style={{ background: "var(--red)" }}
        disabled={!any}
        onClick={() => {
          if (confirm(t("Tanlanganlar butunlay o'chiriladi va hisoblar 0 dan boshlanadi. Buni qaytarib bo'lmaydi. Davom etasizmi?"))) {
            clearData(sel);
            toast(t("Tanlanganlar 0 ga tushirildi"));
          }
        }}
      >
        <Eraser size={14} />
        {t("Nolga tushirish")}
      </button>
    </div>
  );
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const autoLockMin = useAuth((s) => s.autoLockMin);
  const setAutoLockMin = useAuth((s) => s.setAutoLockMin);
  const lock = useAuth((s) => s.lock);
  const resetSample = useDashboard((s) => s.resetSample);
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const cloud = useAuth((s) => s.mode) === "cloud";

  return (
    <Modal open={open} onClose={onClose} title={t("Sozlamalar")} icon={Settings}>
      <section>
        <h3 className="label mb-2.5 flex items-center gap-1.5">
          <Languages size={13} /> {t("Til")}
        </h3>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label={t("Til")}>
          {LANGS.map((l) => {
            const active = lang === l;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLang(l)}
                className={active ? "btn h-10 justify-start px-3.5" : "btn btn-glass h-10 justify-start px-3.5"}
                style={active ? { background: "var(--tab-active-bg)", color: "var(--tab-active-text)" } : undefined}
              >
                <span className="tabular w-6 text-left text-[11px] font-bold opacity-60">{l.toUpperCase()}</span>
                <span className="flex-1 text-left">{LANG_NAMES[l]}</span>
                {active && <Check size={14} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="hairline mt-5 border-t pt-5">
        <h3 className="label mb-2.5">{t("Parolni o'zgartirish")}</h3>
        <ChangePassword />
      </section>

      <section className="hairline mt-5 border-t pt-5">
        <h3 className="label mb-2.5">{t("Avto-qulflash")}</h3>
        <p className="text-2 mb-2.5 text-[13px]">{t("Shuncha vaqt harakat bo'lmasa, ilova qulflanadi va parol so'raydi.")}</p>
        <div className="flex flex-wrap gap-1.5">
          {AUTO_LOCK_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAutoLockMin(v)}
              aria-pressed={autoLockMin === v}
              className={autoLockMin === v ? "btn h-8 px-3 text-[12px]" : "btn btn-glass h-8 px-3 text-[12px]"}
              style={autoLockMin === v ? { background: "var(--tab-active-bg)", color: "var(--tab-active-text)" } : undefined}
            >
              {v === 0 ? t("O'chiq") : v === 60 ? t("1 soat") : t("{n} daqiqa", { n: v })}
            </button>
          ))}
        </div>
      </section>

      <section className="hairline mt-5 border-t pt-5">
        <h3 className="label mb-2.5">{t("Zaxira nusxa")}</h3>
        <BackupSection />
      </section>

      <section className="hairline mt-5 border-t pt-5">
        <h3 className="label mb-1">{t("Nolga tushirish")}</h3>
        <p className="text-2 mb-2.5 text-[13px]">{t("Namuna ma'lumotlarni o'chirib, o'z ishingizni 0 dan boshlash uchun. Nimani tozalashni tanlang:")}</p>
        <ResetToZero />
      </section>

      <section className="hairline mt-5 flex flex-wrap gap-2 border-t pt-5">
        <button
          type="button"
          className="btn btn-glass"
          onClick={() => {
            onClose();
            lock();
          }}
        >
          <Lock size={14} />
          {t("Hozir qulflash")}
        </button>
        <button
          type="button"
          className="btn btn-glass"
          style={{ color: "var(--red)" }}
          onClick={() => {
            if (confirm(t("Barcha ma'lumotlaringiz o'chib, namuna ma'lumotlar qo'yilsinmi? Buni qaytarib bo'lmaydi."))) {
              resetSample();
              toast(t("Namuna ma'lumotlar tiklandi"));
            }
          }}
        >
          <RotateCcw size={14} />
          {t("Namuna ma'lumotlarni tiklash")}
        </button>
      </section>

      <p className="text-3 mt-5 text-[12px] leading-relaxed">
        {cloud
          ? t("Ma'lumotlar bulutda shifrlangan holda saqlanadi va barcha qurilmalaringizda bir xil. Server ularni o'qiy olmaydi.")
          : t("Ma'lumotlar faqat shu brauzerda, parolingizdan olingan kalit bilan shifrlangan holda (AES-256) saqlanadi. Boshqa qurilmada ular ko'rinmaydi.")}
      </p>
    </Modal>
  );
}
