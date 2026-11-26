// Local-time date helpers. Dates are stored as "YYYY-MM-DD" strings in the user's local time zone.

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseISODate(toIso).getTime() - parseISODate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(iso: string): number {
  return (parseISODate(iso).getDay() + 6) % 7;
}

export function isWorkday(iso: string, workdaysPerWeek: number): boolean {
  return weekdayIndex(iso) < workdaysPerWeek;
}

import { WEEKDAYS, WEEKDAYS_SHORT, currentLang, dayMonth } from "@/locales";

/** Weekday names in the current UI language (Monday first). */
export function weekdayNames(short = false): string[] {
  return (short ? WEEKDAYS_SHORT : WEEKDAYS)[currentLang()] ?? [];
}

/** "26-noyabr" (localized) */
export function formatDayMonth(iso: string): string {
  const d = parseISODate(iso);
  return dayMonth(currentLang(), d.getDate(), d.getMonth());
}

/** "26-noyabr, Payshanba" (localized) */
export function formatLong(iso: string): string {
  return `${formatDayMonth(iso)}, ${weekdayNames()[weekdayIndex(iso)]}`;
}

/** "26.11.2026" — matches how dates are usually typed into Notion tables in Uzbekistan. */
export function formatNumeric(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Minutes since midnight for "HH:MM". */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
