// Normalising + validating the optional contact channels of a client.
// Accepts what people usually paste: "@name", "name", or a full profile link.

/** "@name" | "instagram.com/name/?igsh=…" → "name" (or "" if it isn't a valid username). */
export function normalizeInstagram(raw: string): string {
  const v = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#\s]/)[0] ?? "";
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : "";
}

/** "@name" | "t.me/name" | "https://telegram.me/name" → "name". */
export function normalizeTelegram(raw: string): string {
  const v = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(t|telegram)\.me\//i, "")
    .replace(/^@/, "")
    .split(/[/?#\s]/)[0] ?? "";
  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(v) ? v : "";
}

export function normalizeEmail(raw: string): string {
  const v = raw.trim().toLowerCase();
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : "";
}

export const instagramUrl = (h: string) => `https://instagram.com/${encodeURIComponent(h)}`;
export const telegramUrl = (h: string) => `https://t.me/${encodeURIComponent(h)}`;
export const mailtoUrl = (e: string) => `mailto:${e}`;

export function phoneDigitsOk(phone: string): boolean {
  const n = phone.replace(/\D/g, "").length;
  return n >= 7 && n <= 15;
}
