"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { startOfWeek, today } from "@/lib/date";
import { effectiveDaily } from "@/lib/plan";
import type { ContactChannel, DailyReport, FeedbackNote, PlanSettings, Profile, Prospect, RoutineItem, SaleService, WeeklyCommitment } from "@/lib/types";
import { encryptedStorage } from "@/lib/vault";
import { normalizeEmail, normalizeInstagram, normalizeTelegram } from "@/lib/contacts";
import {
  SAMPLE_NICHES,
  sampleCommitments,
  sampleNotes,
  sampleProspects,
  samplePlan,
  sampleReports,
  sampleRoutine,
  uid,
} from "./sampleData";

interface State {
  plan: PlanSettings;
  niches: string[];
  commitments: WeeklyCommitment[];
  routine: RoutineItem[];
  /** Day the routine checkboxes belong to; ticks reset when the day changes. */
  routineDate: string;
  reports: DailyReport[];
  notes: FeedbackNote[];
  prospects: Prospect[];
  profile: Profile;
}

export interface ClearOptions {
  /** Clients, their call ticks and all sales. */
  prospects: boolean;
  /** Daily reports: proposal and call counts, Notion table. */
  reports: boolean;
  /** Call feedback notes (Mulohazalar). */
  notes: boolean;
  /** Start the 1-month plan from this Monday and untick weekly/daily checklists. */
  restartPlan: boolean;
}

interface Actions {
  updatePlan: (patch: Partial<PlanSettings>) => void;
  addNiche: (n: string) => void;
  removeNiche: (n: string) => void;
  addCommitment: (text: string) => void;
  toggleCommitment: (id: string) => void;
  removeCommitment: (id: string) => void;
  toggleRoutine: (id: string) => void;
  addRoutine: (item: Omit<RoutineItem, "id" | "done">) => void;
  removeRoutine: (id: string) => void;
  moveRoutine: (id: string, dir: -1 | 1) => void;
  resetRoutine: () => void;
  ensureRoutineDay: () => void;
  /** Creates or replaces the report for `report.date`. Returns true if it replaced one. */
  saveReport: (report: Omit<DailyReport, "id">) => boolean;
  removeReport: (id: string) => void;
  addNote: (note: Omit<FeedbackNote, "id" | "syncedToNotion">) => void;
  toggleNoteSynced: (id: string) => void;
  markNotesSynced: (ids: string[]) => void;
  removeNote: (id: string) => void;
  addProspect: (p: Pick<Prospect, "firstName" | "lastName" | "phone" | "instagram" | "telegram" | "email" | "niche" | "note">) => boolean;
  updateProspect: (id: string, patch: Pick<Prospect, "firstName" | "lastName" | "phone" | "instagram" | "telegram" | "email" | "niche" | "note">) => void;
  /** Mark as reached today via the given channel (call counts as a call in reports). */
  markContacted: (id: string, channel: ContactChannel) => void;
  /** Project handed over to the client to try; not paid yet. */
  markInProgress: (id: string) => void;
  /** Close the sale. `paidNow` < amount leaves the rest as a debt. */
  markWon: (id: string, amount: number, service: SaleService, paidNow: number) => void;
  addPayment: (id: string, amount: number) => void;
  removePayment: (id: string, paymentId: string) => void;
  markLost: (id: string) => void;
  reopenProspect: (id: string) => void;
  removeProspect: (id: string) => void;
  /** Kanban move to "new" / "progress" / "lost" (contacted needs a channel, won needs an amount). */
  moveProspect: (id: string, stage: "new" | "progress" | "lost") => void;
  resetSample: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  /** Sets the chosen counters back to zero (deletes those records). */
  clearData: (what: ClearOptions) => void;
}

function initialState(): State {
  const plan = samplePlan();
  return {
    plan,
    niches: [...SAMPLE_NICHES],
    commitments: sampleCommitments(),
    routine: sampleRoutine(),
    routineDate: today(),
    reports: sampleReports(plan, effectiveDaily(plan)),
    notes: sampleNotes(),
    prospects: sampleProspects(),
    profile: { firstName: "", lastName: "", goal: "", avatar: null },
  };
}

/** Keeps only digits and a leading "+"; 9-digit Uzbek numbers get +998. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "").slice(0, 15);
  if (!digits) return "";
  if (digits.length === 9) return `+998${digits}`;
  return trimmed.startsWith("+") || digits.length > 9 ? `+${digits}` : digits;
}

/** Back to an open deal: drops any sale/loss data but keeps contact history. */
function reopened(x: Prospect): Prospect {
  return { ...x, outcome: "open", wonAt: null, amount: 0, service: null, payments: undefined };
}

type SetFn = (fn: (s: State) => Partial<State>) => void;
function mapProspect(set: SetFn, id: string, fn: (x: Prospect) => Prospect): void {
  set((s) => ({ prospects: s.prospects.map((x) => (x.id === id ? fn(x) : x)) }));
}

/** A client needs at least one way to reach them. */
function hasContact(p: { phone: string; instagram: string; telegram: string; email: string }): boolean {
  return Boolean(p.phone || p.instagram || p.telegram || p.email);
}

function cleanProspect(p: Pick<Prospect, "firstName" | "lastName" | "phone" | "instagram" | "telegram" | "email" | "niche" | "note">) {
  return {
    firstName: p.firstName.trim().slice(0, 60),
    lastName: p.lastName.trim().slice(0, 60),
    phone: normalizePhone(p.phone),
    instagram: normalizeInstagram(p.instagram ?? ""),
    telegram: normalizeTelegram(p.telegram ?? ""),
    email: normalizeEmail(p.email ?? ""),
    niche: p.niche.trim().slice(0, 60),
    note: p.note.trim().slice(0, 500),
  };
}

const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));

export const useDashboard = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initialState(),

      updatePlan: (patch) =>
        set((s) => {
          const next = { ...s.plan, ...patch };
          next.monthlyTarget = clampInt(next.monthlyTarget, 1, 10_000);
          next.weeks = clampInt(next.weeks, 1, 6);
          next.weeklyTarget = clampInt(next.weeklyTarget, 1, 5_000);
          next.workdaysPerWeek = clampInt(next.workdaysPerWeek, 1, 7);
          next.dailyQuota = clampInt(next.dailyQuota, 1, 500);
          return { plan: next };
        }),

      addNiche: (n) => {
        const v = n.trim().slice(0, 60);
        if (!v || get().niches.some((x) => x.toLowerCase() === v.toLowerCase())) return;
        set((s) => ({ niches: [...s.niches, v] }));
      },
      removeNiche: (n) => set((s) => ({ niches: s.niches.filter((x) => x !== n) })),

      addCommitment: (text) => {
        const v = text.trim().slice(0, 160);
        if (v) set((s) => ({ commitments: [...s.commitments, { id: uid(), text: v, done: false }] }));
      },
      toggleCommitment: (id) =>
        set((s) => ({ commitments: s.commitments.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) })),
      removeCommitment: (id) => set((s) => ({ commitments: s.commitments.filter((c) => c.id !== id) })),

      toggleRoutine: (id) => set((s) => ({ routine: s.routine.map((r) => (r.id === id ? { ...r, done: !r.done } : r)) })),
      addRoutine: (item) => {
        const title = item.title.trim().slice(0, 120);
        if (!title) return;
        set((s) => ({
          routine: [...s.routine, { ...item, title, id: uid(), done: false }].sort((a, b) => a.time.localeCompare(b.time)),
        }));
      },
      removeRoutine: (id) => set((s) => ({ routine: s.routine.filter((r) => r.id !== id) })),
      moveRoutine: (id, dir) =>
        set((s) => {
          const i = s.routine.findIndex((r) => r.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.routine.length) return s;
          const list = [...s.routine];
          const a = list[i]!;
          const b = list[j]!;
          // Swap positions and their time slots so the order stays chronological.
          list[i] = { ...b, time: a.time };
          list[j] = { ...a, time: b.time };
          return { routine: list };
        }),
      resetRoutine: () => set((s) => ({ routine: s.routine.map((r) => ({ ...r, done: false })), routineDate: today() })),
      ensureRoutineDay: () => {
        if (get().routineDate !== today()) get().resetRoutine();
      },

      saveReport: (report) => {
        const existing = get().reports.find((r) => r.date === report.date);
        const clean: DailyReport = {
          id: existing?.id ?? uid(),
          date: report.date,
          proposals: clampInt(report.proposals, 0, 999),
          calls: clampInt(report.calls, 0, 999),
          feedback: report.feedback.trim().slice(0, 2000),
          summary: report.summary.trim().slice(0, 2000),
          status: report.status,
        };
        set((s) => ({
          reports: existing ? s.reports.map((r) => (r.id === existing.id ? clean : r)) : [...s.reports, clean],
        }));
        return Boolean(existing);
      },
      removeReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),

      addNote: (note) => {
        const text = note.text.trim().slice(0, 1000);
        const client = note.client.trim().slice(0, 80);
        if (!text || !client) return;
        set((s) => ({
          notes: [{ ...note, text, client, niche: note.niche.trim().slice(0, 60) || "—", id: uid(), syncedToNotion: false }, ...s.notes],
        }));
      },
      toggleNoteSynced: (id) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, syncedToNotion: !n.syncedToNotion } : n)) })),
      markNotesSynced: (ids) =>
        set((s) => ({ notes: s.notes.map((n) => (ids.includes(n.id) ? { ...n, syncedToNotion: true } : n)) })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addProspect: (p) => {
        const clean = cleanProspect(p);
        if (!clean.firstName || !hasContact(clean)) return false;
        set((s) => ({
          prospects: [
            {
              ...clean,
              id: uid(),
              createdAt: today(),
              proposalAt: null,
              calledAt: null,
              contactedAt: null,
              contactChannel: null,
              inProgressAt: null,
              outcome: "open",
              wonAt: null,
              amount: 0,
              service: null,
            },
            ...s.prospects,
          ],
        }));
        return true;
      },
      updateProspect: (id, patch) => {
        const clean = cleanProspect(patch);
        if (!clean.firstName || !hasContact(clean)) return;
        set((s) => ({ prospects: s.prospects.map((x) => (x.id === id ? { ...x, ...clean } : x)) }));
      },
      markContacted: (id, channel) =>
        mapProspect(set, id, (x) => {
          const d = today();
          return {
            ...reopened(x),
            contactedAt: x.contactedAt ?? d,
            contactChannel: channel,
            proposalAt: x.proposalAt ?? d,
            calledAt: channel === "call" ? (x.calledAt ?? d) : x.calledAt,
            inProgressAt: null,
          };
        }),
      markInProgress: (id) =>
        mapProspect(set, id, (x) => ({
          ...reopened(x),
          contactedAt: x.contactedAt ?? x.calledAt ?? x.proposalAt ?? today(),
          inProgressAt: x.inProgressAt ?? today(),
        })),
      markWon: (id, amount, service, paidNow) =>
        mapProspect(set, id, (x) => {
          const total = clampInt(amount, 0, 10_000_000);
          const paid = clampInt(paidNow, 0, total);
          return {
            ...x,
            outcome: "won",
            wonAt: today(),
            amount: total,
            service,
            payments: paid > 0 ? [{ id: uid(), date: today(), amount: paid }] : [],
          };
        }),
      addPayment: (id, amount) =>
        mapProspect(set, id, (x) => {
          const owed = Math.max(0, x.amount - (x.payments ?? []).reduce((s, p) => s + p.amount, 0));
          const v = clampInt(amount, 0, owed);
          if (v <= 0 || !x.payments) return x;
          return { ...x, payments: [...x.payments, { id: uid(), date: today(), amount: v }] };
        }),
      removePayment: (id, paymentId) =>
        mapProspect(set, id, (x) => ({ ...x, payments: (x.payments ?? []).filter((p) => p.id !== paymentId) })),
      markLost: (id) => mapProspect(set, id, (x) => ({ ...x, outcome: "lost", wonAt: null, amount: 0, service: null, payments: undefined })),
      reopenProspect: (id) => mapProspect(set, id, (x) => reopened(x)),
      moveProspect: (id, stage) =>
        mapProspect(set, id, (x) => {
          if (stage === "lost") return { ...x, outcome: "lost", wonAt: null, amount: 0, service: null, payments: undefined };
          if (stage === "progress") return { ...reopened(x), contactedAt: x.contactedAt ?? x.calledAt ?? x.proposalAt ?? today(), inProgressAt: x.inProgressAt ?? today() };
          return { ...reopened(x), proposalAt: null, calledAt: null, contactedAt: null, contactChannel: null, inProgressAt: null };
        }),
      removeProspect: (id) => set((s) => ({ prospects: s.prospects.filter((x) => x.id !== id) })),

      resetSample: () => set({ ...initialState(), profile: get().profile }),
      updateProfile: (patch) =>
        set((s) => ({
          profile: {
            firstName: (patch.firstName ?? s.profile.firstName).slice(0, 60),
            lastName: (patch.lastName ?? s.profile.lastName).slice(0, 60),
            goal: (patch.goal ?? s.profile.goal).slice(0, 200),
            avatar: patch.avatar !== undefined ? patch.avatar : s.profile.avatar,
            avatarSrc: patch.avatarSrc !== undefined ? patch.avatarSrc : (s.profile.avatarSrc ?? null),
            avatarCrop: patch.avatarCrop !== undefined ? patch.avatarCrop : (s.profile.avatarCrop ?? null),
          },
        })),
      clearData: (what) =>
        set((s) => ({
          prospects: what.prospects ? [] : s.prospects,
          reports: what.reports ? [] : s.reports,
          notes: what.notes ? [] : s.notes,
          commitments: what.restartPlan ? s.commitments.map((c) => ({ ...c, done: false })) : s.commitments,
          routine: what.restartPlan ? s.routine.map((r) => ({ ...r, done: false })) : s.routine,
          routineDate: what.restartPlan ? today() : s.routineDate,
          plan: what.restartPlan ? { ...s.plan, startDate: startOfWeek(today()) } : s.plan,
        })),
    }),
    {
      name: "acquisition-dashboard:v1",
      // Encrypted with a key derived from the owner's password (see src/lib/vault.ts).
      storage: createJSONStorage(() => encryptedStorage),
      version: 1,
      partialize: ({ plan, niches, commitments, routine, routineDate, reports, notes, prospects, profile }) => ({
        plan, niches, commitments, routine, routineDate, reports, notes, prospects, profile,
      }),
      // Hydrated manually after unlock, once the decryption key exists.
      skipHydration: true,
    },
  ),
);

