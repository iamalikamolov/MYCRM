"use client";

import { ClipboardCopy, DollarSign, HandCoins, Plus, Users, Wallet, X } from "lucide-react";
import { useState } from "react";
import { formatDayMonth, formatNumeric } from "@/lib/date";
import { confettiFrom } from "@/lib/motion";
import { copyText } from "@/lib/notion";
import { debtOf, lastPaymentDate, paidOf } from "@/lib/pipeline";
import { type SalesStats, usd } from "@/lib/sales";
import type { Prospect } from "@/lib/types";
import { getT, useT } from "@/locales";
import { useDashboard } from "@/store/useDashboard";
import { ContactLinks } from "./ContactLinks";
import { CountUp } from "./motion";
import { serviceLabel } from "./Prospects";
import { GlassCard, ProgressBar, cn, toast } from "./ui";

function debtsToMarkdown(list: Prospect[]): string {
  const t = getT();
  const head = [t("Mijoz"), t("Jami|money"), t("To'langan"), t("Qarz"), t("Oxirgi to'lov")];
  const rows = list.map((p) => {
    const last = lastPaymentDate(p);
    return [`${p.firstName} ${p.lastName}`.trim(), usd(p.amount), usd(paidOf(p)), usd(debtOf(p)), last ? formatNumeric(last) : "—"];
  });
  const line = (r: string[]) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
}

function DebtRow({ p }: { p: Prospect }) {
  const t = useT();
  const addPayment = useDashboard((s) => s.addPayment);
  const removePayment = useDashboard((s) => s.removePayment);
  const [amount, setAmount] = useState("");
  const paid = paidOf(p);
  const debt = debtOf(p);
  const value = Number(amount);
  const tooMuch = value > debt;
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

  function pay(v: number, from: Element | null) {
    if (!(v > 0) || v > debt) return;
    const closes = v >= debt;
    addPayment(p.id, v);
    setAmount("");
    if (closes) {
      confettiFrom(from);
      toast(t("{name} qarzni to'liq yopdi 🎉", { name: p.firstName }));
    } else {
      toast(t("To'lov yozildi: {amount}", { amount: usd(v) }));
    }
  }

  return (
    <li className="glass-strong p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className="grid size-10 flex-none place-items-center rounded-full text-[13px] font-bold"
          style={{ background: "color-mix(in srgb, var(--orange) 16%, transparent)", color: "var(--orange)" }}
        >
          {initials || "?"}
        </span>
        <div className="min-w-[160px] flex-1">
          <div className="text-[15px] font-semibold">
            {p.firstName} {p.lastName}
          </div>
          <div className="text-3 text-[12px]">
            {[p.service && serviceLabel(p.service), p.niche, p.wonAt && formatDayMonth(p.wonAt)].filter(Boolean).join(" · ")}
          </div>
          <ContactLinks p={p} className="text-2 mt-1 text-[12.5px]" />
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          {(
            [
              [t("Jami|money"), p.amount, "var(--text)"],
              [t("To'langan"), paid, "var(--green)"],
              [t("Qarz"), debt, "var(--orange)"],
            ] as const
          ).map(([label, v, color]) => (
            <div key={label}>
              <div className="label">{label}</div>
              <div className="tabular text-[17px] font-semibold" style={{ color }}>
                {usd(v)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ProgressBar value={p.amount ? (paid / p.amount) * 100 : 0} from="var(--green)" to="color-mix(in srgb, var(--green) 60%, var(--accent))" className="mt-3" label={t("To'langan")} />

      {(p.payments?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="label mr-1">{t("To'lovlar tarixi")}</span>
          {p.payments!.map((x) => (
            <span key={x.id} className="pill tone-green h-7 pr-1 pl-2.5 text-[12px]">
              {formatDayMonth(x.date)} · {usd(x.amount)}
              <button type="button" className="icon-btn size-5" aria-label={t("To'lovni o'chirish")} onClick={() => removePayment(p.id, x.id)}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          pay(value, e.currentTarget.querySelector("button[type=submit]"));
        }}
      >
        <div className="relative w-36">
          <DollarSign size={14} className="text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            className="field tabular h-9 pl-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            type="number"
            inputMode="decimal"
            min={1}
            max={debt}
            placeholder={String(debt)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={t("To'lov summasi")}
            aria-invalid={tooMuch}
            style={tooMuch ? { borderColor: "var(--red)" } : undefined}
          />
        </div>
        <button type="submit" className="btn btn-primary h-9" disabled={!(value > 0) || tooMuch}>
          <Plus size={14} />
          {t("To'lov qo'shish")}
        </button>
        <button
          type="button"
          className="btn btn-glass h-9"
          style={{ color: "var(--green)" }}
          onClick={(e) => pay(debt, e.currentTarget)}
        >
          <Wallet size={14} />
          {t("Qolganini to'ladi")} · {usd(debt)}
        </button>
        {tooMuch && (
          <span className="text-[12px]" style={{ color: "var(--red)" }}>
            {t("Qarz {owed} — undan oshmasin", { owed: usd(debt) })}
          </span>
        )}
      </form>
    </li>
  );
}

export function DebtsView({ sales }: { sales: SalesStats }) {
  const t = useT();
  const prospects = useDashboard((s) => s.prospects);
  const debtors = prospects.filter((p) => debtOf(p) > 0).sort((a, b) => debtOf(b) - debtOf(a));

  return (
    <div className="grid gap-5">
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            [HandCoins, t("Umumiy qarz"), <CountUp key="d" value={sales.debtTotal} format={(n) => usd(Math.round(n))} />, "var(--orange)"],
            [Users, t("Qarzdorlar"), <CountUp key="n" value={sales.debtors} />, "var(--text)"],
            [Wallet, t("Shu oy tushgan"), <CountUp key="r" value={sales.receivedMonth} format={(n) => usd(Math.round(n))} />, "var(--green)"],
          ] as const
        ).map(([Icon, label, value, color]) => (
          <div key={label} data-tilt className="glass rounded-[22px] p-4">
            <div className="flex items-center justify-between">
              <span className="label">{label}</span>
              <Icon size={15} className="text-3" />
            </div>
            <div className="tabular mt-2 text-[26px] leading-none font-semibold tracking-[-0.03em]" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <GlassCard
        icon={HandCoins}
        iconTone="var(--orange)"
        eyebrow={t("Sotildi, lekin to'liq to'lanmagan")}
        title={t("Pulini bo'lib to'layotgan mijozlar")}
        subtitle={t("Sotuvda qisman to'lov kiritsangiz, mijoz shu yerda chiqadi")}
        actions={
          <button
            type="button"
            className="btn btn-glass"
            disabled={!debtors.length}
            onClick={async () => {
              if (await copyText(debtsToMarkdown(debtors))) toast(t("Qarzlar jadvali nusxalandi — Notionga joylang"));
            }}
          >
            <ClipboardCopy size={14} />
            {t("Notion uchun nusxalash")}
          </button>
        }
      >
        {debtors.length === 0 ? (
          <div className="text-3 py-10 text-center text-[14px]">{t("Qarzdor yo'q 🎉")}</div>
        ) : (
          <ul className={cn("flex flex-col gap-3")}>
            {debtors.map((p) => (
              <DebtRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
