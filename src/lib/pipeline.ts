import type { Prospect, Stage } from "./types";

export const STAGES: readonly Stage[] = ["new", "contacted", "progress", "won", "lost"];

/**
 * Stage of a prospect. Older saved data only has proposalAt/calledAt — any of those
 * counts as "contacted", so nothing is lost when the pipeline changed.
 */
export function stageOf(p: Prospect): Stage {
  if (p.outcome === "won") return "won";
  if (p.outcome === "lost") return "lost";
  if (p.inProgressAt) return "progress";
  if (p.contactedAt || p.calledAt || p.proposalAt) return "contacted";
  return "new";
}

/** Day the client was first reached (falls back to the old fields). */
export function contactedOn(p: Prospect): string | null {
  return p.contactedAt ?? p.calledAt ?? p.proposalAt ?? null;
}

/** Money received for a won deal. Old sales without a payment list were paid in full. */
export function paidOf(p: Prospect): number {
  if (p.outcome !== "won") return 0;
  if (!p.payments) return p.amount;
  return p.payments.reduce((s, x) => s + x.amount, 0);
}

/** What the client still owes (never negative). */
export function debtOf(p: Prospect): number {
  return p.outcome === "won" ? Math.max(0, p.amount - paidOf(p)) : 0;
}

export function lastPaymentDate(p: Prospect): string | null {
  const list = p.payments ?? [];
  return list.length ? list.reduce((a, b) => (b.date > a ? b.date : a), list[0]!.date) : p.wonAt;
}
