export type ReportStatus = "done" | "partial" | "missed";

export interface PlanSettings {
  /** First day (Monday) of the 1-month plan. */
  startDate: string;
  monthlyTarget: number;
  weeks: number;
  /** When true, weeklyTarget = ceil(monthlyTarget / weeks). */
  autoWeekly: boolean;
  weeklyTarget: number;
  workdaysPerWeek: number;
  /** When true, dailyQuota = ceil(weeklyTarget / workdaysPerWeek). */
  autoDaily: boolean;
  dailyQuota: number;
  /** Target: call every prospect a proposal was sent to (calls per proposal, as %). */
  callCoveragePct: number;
}

export interface WeeklyCommitment {
  id: string;
  text: string;
  done: boolean;
}

export interface RoutineItem {
  id: string;
  time: string; // "HH:MM"
  durationMin: number;
  title: string;
  done: boolean;
}

export interface DailyReport {
  id: string;
  date: string;
  proposals: number;
  calls: number;
  /** Key feedback & objections (Mulohazalar). */
  feedback: string;
  summary: string;
  status: ReportStatus;
}

export type NoteKind = "objection" | "interest" | "callback" | "rejected";

export interface FeedbackNote {
  id: string;
  date: string;
  client: string;
  niche: string;
  kind: NoteKind;
  text: string;
  syncedToNotion: boolean;
}

export type ProspectOutcome = "open" | "won" | "lost";
export const SALE_SERVICES = ["Landing Page", "Telegram Bot", "Telegram Mini App", "Boshqa"] as const;
export type SaleService = (typeof SALE_SERVICES)[number];

/** How the client was reached at the "contacted" stage. */
export const CONTACT_CHANNELS = ["call", "telegram", "instagram", "whatsapp", "email", "meeting", "other"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

/** Pipeline stage, derived from the prospect's dates/outcome (see stageOf in lib/pipeline). */
export type Stage = "new" | "contacted" | "progress" | "won" | "lost";

export interface SalePayment {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // USD
}

/**
 * A person/company found while prospecting.
 * Moves: new → contacted (call / Telegram / Instagram / WhatsApp / …) → in progress
 * (project handed over for testing, not paid yet) → sold (with payments) / lost.
 */
export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  /** May be "" when the client was found on Instagram/Telegram/email only. */
  phone: string;
  /** Optional channels (stored as bare handle / address). */
  instagram?: string;
  telegram?: string;
  email?: string;
  niche: string;
  note: string;
  createdAt: string; // YYYY-MM-DD
  proposalAt: string | null;
  calledAt: string | null;
  /** Day the client was first reached, and how. */
  contactedAt?: string | null;
  contactChannel?: ContactChannel | null;
  /** Day the project was handed over for the client to try (not paid yet). */
  inProgressAt?: string | null;
  outcome: ProspectOutcome;
  /** Day the sale closed (outcome = "won"). */
  wonAt: string | null;
  /** Sale amount in USD (outcome = "won"). */
  amount: number;
  service: SaleService | null;
  /** Money actually received for the sale. Missing on old data = paid in full. */
  payments?: SalePayment[];
}

export interface Profile {
  firstName: string;
  lastName: string;
  /** Personal goal shown on the Overview page. */
  goal: string;
  /** Final cropped avatar: 256px JPEG data URL, or null. */
  avatar: string | null;
  /** Downscaled original photo (max 900px) so the crop can be adjusted again later. */
  avatarSrc?: string | null;
  /** Crop: centre of the circle as a fraction of the image (0–1), and zoom (1 = fit). */
  avatarCrop?: { cx: number; cy: number; zoom: number } | null;
}
