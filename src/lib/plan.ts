import { addDays, daysBetween, isWorkday, startOfWeek, today } from "./date";
import type { DailyReport, PlanSettings, ReportStatus } from "./types";

export function effectiveWeekly(p: PlanSettings): number {
  return p.autoWeekly ? Math.ceil(p.monthlyTarget / Math.max(1, p.weeks)) : p.weeklyTarget;
}

export function effectiveDaily(p: PlanSettings): number {
  return p.autoDaily ? Math.ceil(effectiveWeekly(p) / Math.max(1, p.workdaysPerWeek)) : p.dailyQuota;
}

export function planEndDate(p: PlanSettings): string {
  return addDays(p.startDate, p.weeks * 7 - 1);
}

/** 1-based week number of `iso` within the plan, or null if outside. */
export function weekOfPlan(p: PlanSettings, iso: string): number | null {
  const diff = daysBetween(p.startDate, iso);
  if (diff < 0 || diff >= p.weeks * 7) return null;
  return Math.floor(diff / 7) + 1;
}

export function autoStatus(proposals: number, quota: number): ReportStatus {
  if (proposals >= quota) return "done";
  if (proposals >= Math.ceil(quota / 2)) return "partial";
  return "missed";
}

export interface PlanStats {
  monthlyTarget: number;
  weeklyTarget: number;
  dailyQuota: number;
  sentMonth: number;
  callsMonth: number;
  remainingMonth: number;
  currentWeek: number | null;
  sentWeek: number;
  callsWeek: number;
  remainingWeek: number;
  daysLeft: number;
  workdaysLeft: number;
  /** Proposals per remaining workday (including today) needed to hit the monthly target. */
  requiredPace: number;
  callCoverage: number;
  perWeek: { week: number; sent: number; target: number }[];
  /** Mon..Sun of the current calendar week. */
  thisWeekDays: { date: string; sent: number; calls: number; isWorkday: boolean }[];
  todayReport: DailyReport | undefined;
}

export function computeStats(p: PlanSettings, reports: DailyReport[]): PlanStats {
  const t = today();
  const weekly = effectiveWeekly(p);
  const daily = effectiveDaily(p);
  const end = planEndDate(p);
  const inPlan = reports.filter((r) => r.date >= p.startDate && r.date <= end);

  const sentMonth = inPlan.reduce((s, r) => s + r.proposals, 0);
  const callsMonth = inPlan.reduce((s, r) => s + r.calls, 0);
  const currentWeek = weekOfPlan(p, t);

  const perWeek = Array.from({ length: p.weeks }, (_, i) => {
    const wStart = addDays(p.startDate, i * 7);
    const wEnd = addDays(wStart, 6);
    const sent = inPlan.filter((r) => r.date >= wStart && r.date <= wEnd).reduce((s, r) => s + r.proposals, 0);
    return { week: i + 1, sent, target: weekly };
  });

  const weekEntry = currentWeek ? perWeek[currentWeek - 1] : undefined;
  const sentWeek = weekEntry?.sent ?? 0;
  const callsWeek = currentWeek
    ? inPlan
        .filter((r) => weekOfPlan(p, r.date) === currentWeek)
        .reduce((s, r) => s + r.calls, 0)
    : 0;

  const daysLeft = Math.max(0, daysBetween(t, end) + 1);
  let workdaysLeft = 0;
  for (let i = 0; i < daysLeft; i++) {
    if (isWorkday(addDays(t, i), p.workdaysPerWeek)) workdaysLeft++;
  }
  // If today's report is already in, today no longer counts as a remaining workday.
  const todayReport = reports.find((r) => r.date === t);
  if (todayReport && isWorkday(t, p.workdaysPerWeek) && workdaysLeft > 0) workdaysLeft--;

  const remainingMonth = Math.max(0, p.monthlyTarget - sentMonth);
  const calWeekStart = startOfWeek(t);
  const thisWeekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(calWeekStart, i);
    const r = reports.find((x) => x.date === date);
    return { date, sent: r?.proposals ?? 0, calls: r?.calls ?? 0, isWorkday: isWorkday(date, p.workdaysPerWeek) };
  });

  return {
    monthlyTarget: p.monthlyTarget,
    weeklyTarget: weekly,
    dailyQuota: daily,
    sentMonth,
    callsMonth,
    remainingMonth,
    currentWeek,
    sentWeek,
    callsWeek,
    remainingWeek: Math.max(0, weekly - sentWeek),
    daysLeft,
    workdaysLeft,
    requiredPace: workdaysLeft > 0 ? Math.ceil(remainingMonth / workdaysLeft) : remainingMonth,
    callCoverage: sentMonth > 0 ? Math.round((callsMonth / sentMonth) * 100) : 0,
    perWeek,
    thisWeekDays,
    todayReport,
  };
}

export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}
