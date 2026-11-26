"use client";

import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { PASSWORD_MIN } from "@/lib/vault";
import { LANGS, useLang, useT } from "@/locales";
import { useAuth } from "@/store/useAuth";
import { useDashboard } from "@/store/useDashboard";

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  autoComplete: "current-password" | "new-password";
  label: string;
}) {
  const [show, setShow] = useState(false);
  const t = useT();
  return (
    <div className="relative">
      <input
        className="field h-11 pr-11 text-[15px]"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        aria-label={label}
        maxLength={200}
      />
      <button
        type="button"
        className="icon-btn absolute top-1/2 right-1.5 -translate-y-1/2"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("Parolni yashirish") : t("Parolni ko'rsatish")}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

const MAX_TRIES = 5;
const COOLDOWN_S = 30;

function LockScreen() {
  const status = useAuth((s) => s.status);
  const setup = useAuth((s) => s.setup);
  const unlock = useAuth((s) => s.unlock);
  const wipe = useAuth((s) => s.wipe);
  const isSetup = status === "setup";
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [wipeText, setWipeText] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (isSetup) {
      if (pw.length < PASSWORD_MIN) return setError(t("Parol kamida {n} ta belgidan iborat bo'lsin", { n: PASSWORD_MIN }));
      if (pw !== pw2) return setError(t("Parollar bir xil emas"));
      setBusy(true);
      await setup(pw);
      setBusy(false);
      return;
    }
    if (cooldown > 0) return;
    setBusy(true);
    const ok = await unlock(pw);
    setBusy(false);
    if (!ok) {
      const n = fails + 1;
      setFails(n);
      setShakeKey((k) => k + 1);
      setPw("");
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>("main form input")?.focus());
      if (n >= MAX_TRIES) {
        setFails(0);
        setCooldown(COOLDOWN_S);
        setError(t("{n} marta noto'g'ri. {s} soniya kuting.", { n: MAX_TRIES, s: COOLDOWN_S }));
      } else {
        setError(t("Parol noto'g'ri ({n} urinish qoldi)", { n: MAX_TRIES - n }));
      }
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div key={shakeKey} className={`glass w-full max-w-[400px] p-7 ${shakeKey ? "shake" : "modal-in"}`}>
        <div
          className="mx-auto mb-5 grid size-14 place-items-center rounded-[20px]"
          style={{ background: "linear-gradient(140deg, var(--accent), var(--accent-2))", color: "var(--on-accent)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.4), 0 12px 30px -10px var(--accent)" }}
        >
          {isSetup ? <ShieldCheck size={26} /> : <Lock size={24} />}
        </div>
        <h1 className="text-center text-[22px] font-semibold tracking-[-0.02em]">{isSetup ? t("Parol o'rnating") : t("Xush kelibsiz")}</h1>
        <p className="text-2 mt-1.5 mb-6 text-center text-[13.5px]">
          {isSetup ? t("Ma'lumotlaringiz shu parol bilan shifrlanadi. Uni unutmang — tiklab bo'lmaydi.") : t("Davom etish uchun parolingizni kiriting")}
        </p>

        {!forgot ? (
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <PasswordInput value={pw} onChange={setPw} placeholder={t("Parol")} autoFocus autoComplete={isSetup ? "new-password" : "current-password"} label={t("Parol")} />
            {isSetup && <PasswordInput value={pw2} onChange={setPw2} placeholder={t("Parolni takrorlang")} autoComplete="new-password" label={t("Parolni takrorlang")} />}
            {error && (
              <p className="text-[13px]" role="alert" style={{ color: "var(--red)" }}>
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary mt-1 h-11 text-[14px]" disabled={busy || !pw || cooldown > 0}>
              <KeyRound size={16} />
              {busy ? t("Tekshirilmoqda…") : cooldown > 0 ? t("{s} s kuting", { s: cooldown }) : isSetup ? t("Parolni saqlash va kirish") : t("Kirish")}
            </button>
            {!isSetup && (
              <button type="button" className="text-3 mt-1 text-[12.5px] hover:underline" onClick={() => setForgot(true)}>
                {t("Parolni unutdingizmi?")}
              </button>
            )}
          </form>
        ) : (
          <div className="flex flex-col gap-3 text-[13.5px]">
            <p className="text-2">
              {t("Ma'lumotlar parol bilan shifrlangan, shuning uchun parolsiz ularni ochib bo'lmaydi. Yagona yo'l — hammasini o'chirib, yangi parol bilan boshlash. Davom etish uchun quyidagi so'zni yozing:")}{" "}
              <b>{t("O'CHIRISH")}</b>
            </p>
            <input className="field" value={wipeText} onChange={(e) => setWipeText(e.target.value)} placeholder={t("O'CHIRISH")} aria-label={t("Tasdiqlash")} />
            <div className="flex gap-2">
              <button type="button" className="btn btn-glass flex-1" onClick={() => setForgot(false)}>
                {t("Orqaga")}
              </button>
              <button
                type="button"
                className="btn flex-1 text-white"
                style={{ background: "var(--red)" }}
                disabled={wipeText.trim().localeCompare(t("O'CHIRISH"), undefined, { sensitivity: "base" }) !== 0}
                onClick={() => {
                  wipe();
                  useDashboard.getState().resetSample();
                  setForgot(false);
                  setWipeText("");
                }}
              >
                {t("Hammasini o'chirish")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="fade-in mt-5 flex flex-wrap justify-center gap-1" role="radiogroup" aria-label={t("Til")}>
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={lang === l}
            onClick={() => setLang(l)}
            className="rounded-full px-3 py-1 text-[12px] font-semibold transition-colors"
            style={lang === l ? { background: "var(--tab-active-bg)", color: "var(--tab-active-text)" } : { color: "var(--text-2)" }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </main>
  );
}

/** Locks after `autoLockMin` minutes without mouse/keyboard/touch activity. */
function useAutoLock() {
  const status = useAuth((s) => s.status);
  const minutes = useAuth((s) => s.autoLockMin);
  const lock = useAuth((s) => s.lock);
  const last = useRef(0);

  useEffect(() => {
    if (status !== "unlocked" || minutes <= 0) return;
    last.current = Date.now();
    const bump = () => {
      last.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = setInterval(() => {
      if (Date.now() - last.current > minutes * 60_000) lock();
    }, 10_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(id);
    };
  }, [status, minutes, lock]);
}

export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const init = useAuth((s) => s.init);
  const [ready, setReady] = useState(false);

  useEffect(() => init(), [init]);
  useAutoLock();

  // Decrypt and load the data once the key exists.
  useEffect(() => {
    if (status !== "unlocked") {
      setReady(false);
      return;
    }
    let alive = true;
    void Promise.resolve(useDashboard.persist.rehydrate()).then(() => {
      if (!alive) return;
      useDashboard.getState().ensureRoutineDay();
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [status]);

  if (status === "loading") return null;
  if (status !== "unlocked") return <LockScreen />;
  if (!ready) return null;
  return <>{children}</>;
}
