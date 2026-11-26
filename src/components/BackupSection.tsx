"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { today } from "@/lib/date";
import * as vault from "@/lib/vault";
import { useT } from "@/locales";
import { useDashboard } from "@/store/useDashboard";
import { PasswordInput } from "./AuthGate";
import { toast } from "./ui";

/** Encrypted backup: download a file, or restore one (e.g. to move data to a new device or site). */
export function BackupSection() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function download() {
    setError("");
    try {
      const text = await vault.exportBackup();
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `mijoz-topish-zaxira-${today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(t("Zaxira fayl saqlandi"));
    } catch {
      setError(t("Serverda xatolik. Birozdan keyin qayta urining."));
    }
  }

  async function restore() {
    if (!file) return;
    if (!confirm(t("Hozirgi ma'lumotlar fayldagilar bilan almashtiriladi. Davom etasizmi?"))) return;
    setError("");
    setBusy(true);
    try {
      const ok = await vault.importBackup(file.text, pw);
      if (!ok) {
        setError(t("Fayl paroli noto'g'ri"));
      } else {
        await useDashboard.persist.rehydrate();
        setFile(null);
        setPw("");
        toast(t("Ma'lumotlar fayldan tiklandi"));
      }
    } catch (e) {
      setError(e instanceof Error && e.message === "format" ? t("Fayl noto'g'ri yoki buzilgan") : t("Serverda xatolik. Birozdan keyin qayta urining."));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-2 text-[13px]">
        {t("Ma'lumotlarni shifrlangan fayl qilib saqlab oling yoki boshqa qurilmadan yuklang. Faylni ochish uchun o'sha paroli kerak.")}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-glass" onClick={download}>
          <Download size={14} />
          {t("Yuklab olish")}
        </button>
        <button type="button" className="btn btn-glass" onClick={() => fileRef.current?.click()}>
          <Upload size={14} />
          {t("Fayldan tiklash")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f || f.size > 20_000_000) return setError(t("Fayl noto'g'ri yoki buzilgan"));
            setError("");
            setFile({ name: f.name, text: await f.text() });
          }}
        />
      </div>
      {file && (
        <div className="glass-strong flex flex-col gap-2 p-3">
          <span className="text-2 truncate text-[12.5px]">{t("Fayl tanlangan: {name}", { name: file.name })}</span>
          <PasswordInput value={pw} onChange={setPw} placeholder={t("Fayl paroli")} autoComplete="current-password" label={t("Fayl paroli")} />
          <button type="button" className="btn btn-primary self-start" disabled={!pw || busy} onClick={restore}>
            <Upload size={14} />
            {busy ? t("Tekshirilmoqda…") : t("Tiklash")}
          </button>
        </div>
      )}
      {error && (
        <p className="text-[13px]" role="alert" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
