import { startOfWeek, today } from "./date";
import { planEndDate } from "./plan";
import { contactedOn, debtOf, paidOf, stageOf } from "./pipeline";
import type { PlanSettings, Prospect } from "./types";

export interface SalesStats {
  /** Sales closed inside the current 1-month plan window. */
  count: number;
  revenue: number;
  weekCount: number;
  weekRevenue: number;
  allTimeCount: number;
  allTimeRevenue: number;
  /** Won ÷ (won + lost), in %. null while nothing is closed yet. */
  conversion: number | null;
  /** Prospects first reached today (any channel) and calls made today. */
  contactedToday: number;
  callsToday: number;
  /** Open prospects nobody has reached yet (the contact queue). */
  waitingContact: number;
  /** Deals handed over for testing, not paid yet. */
  inProgress: number;
  /** Money actually received: all time, and in the current calendar month. */
  received: number;
  receivedMonth: number;
  /** Unpaid balances of sold deals. */
  debtTotal: number;
  debtors: number;
}

export function computeSales(plan: PlanSettings, prospects: Prospect[]): SalesStats {
  const t = today();
  const end = planEndDate(plan);
  const week = startOfWeek(t);
  const won = prospects.filter((p): p is Prospect & { wonAt: string } => p.outcome === "won" && p.wonAt !== null);
  const inPlan = won.filter((p) => p.wonAt >= plan.startDate && p.wonAt <= end);
  const inWeek = won.filter((p) => p.wonAt >= week);
  const closed = prospects.filter((p) => p.outcome !== "open").length;
  return {
    count: inPlan.length,
    revenue: inPlan.reduce((s, p) => s + p.amount, 0),
    weekCount: inWeek.length,
    weekRevenue: inWeek.reduce((s, p) => s + p.amount, 0),
    allTimeCount: won.length,
    allTimeRevenue: won.reduce((s, p) => s + p.amount, 0),
    conversion: closed ? Math.round((won.length / closed) * 100) : null,
    contactedToday: prospects.filter((p) => contactedOn(p) === t).length,
    callsToday: prospects.filter((p) => p.calledAt === t).length,
    waitingContact: prospects.filter((p) => stageOf(p) === "new").length,
    inProgress: prospects.filter((p) => stageOf(p) === "progress").length,
    received: won.reduce((s, p) => s + paidOf(p), 0),
    receivedMonth: won.reduce(
      (s, p) =>
        s +
        (p.payments
          ? p.payments.filter((x) => x.date.slice(0, 7) === t.slice(0, 7)).reduce((a, x) => a + x.amount, 0)
          : p.wonAt.slice(0, 7) === t.slice(0, 7)
            ? p.amount
            : 0),
      0,
    ),
    debtTotal: won.reduce((s, p) => s + debtOf(p), 0),
    debtors: won.filter((p) => debtOf(p) > 0).length,
  };
}

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** "+998 90 123 45 67" for Uzbek numbers, otherwise as stored. */
export function formatPhone(p: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}
