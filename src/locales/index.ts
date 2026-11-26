import { useCallback } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DICT, type TKey } from "./dictionary";

export type { TKey };
export const LANGS = ["uz", "ru", "tj", "en", "tr"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "uz";

/** Native names shown in the language picker. */
export const LANG_NAMES: Record<Lang, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  tj: "Тоҷикӣ",
  en: "English",
  tr: "Türkçe",
};
/** BCP-47 tag for <html lang> (Tajik is "tg"). */
export const HTML_LANG: Record<Lang, string> = { uz: "uz", ru: "ru", tj: "tg", en: "en", tr: "tr" };

const COLUMN: Record<Exclude<Lang, "uz">, 0 | 1 | 2 | 3> = { ru: 0, tj: 1, en: 2, tr: 3 };

export type TVars = Record<string, string | number>;

export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  const raw: string = lang === "uz" ? (key.split("|")[0] ?? key) : DICT[key][COLUMN[lang]];
  return vars ? raw.replace(/\{(\w+)\}/g, (m: string, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

// ─── Language store (plain localStorage: the language is not sensitive) ─────
export const LANG_KEY = "acq:lang";

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLang = create<LangState>()(
  persist(
    (set) => ({
      lang: DEFAULT_LANG,
      setLang: (lang: Lang) => {
        set({ lang });
        if (typeof document !== "undefined") document.documentElement.lang = HTML_LANG[lang];
      },
    }),
    {
      name: LANG_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      onRehydrateStorage: () => (s?: LangState) => {
        if (s && typeof document !== "undefined") document.documentElement.lang = HTML_LANG[s.lang];
      },
    },
  ),
);

export type TFn = (key: TKey, vars?: TVars) => string;

/** Translator bound to the current language; components re-render when it changes. */
export function useT(): TFn {
  const lang = useLang((s) => s.lang);
  return useCallback((key: TKey, vars?: TVars) => translate(lang, key, vars), [lang]);
}

/** For code outside React render (exports, toasts in plain functions). */
export function getT(): TFn {
  const lang = useLang.getState().lang;
  return (key, vars) => translate(lang, key, vars);
}

export function currentLang(): Lang {
  return useLang.getState().lang;
}

// ─── Dates ───────────────────────────────────────────────────────────────────
const MONTHS: Record<Lang, string[]> = {
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  tj: ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
};
export const MONTHS_SHORT: Record<Lang, string[]> = {
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  tj: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
};
export const WEEKDAYS: Record<Lang, string[]> = {
  uz: ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"],
  ru: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
  tj: ["Душанбе", "Сешанбе", "Чоршанбе", "Панҷшанбе", "Ҷумъа", "Шанбе", "Якшанбе"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  tr: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"],
};
export const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  tj: ["Дш", "Сш", "Чш", "Пш", "Ҷм", "Шб", "Яш"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  tr: ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"],
};

/** "26-noyabr" / "26 ноября" / "Nov 26" / "26 Kasım" */
export function dayMonth(lang: Lang, day: number, monthIndex: number): string {
  const m = MONTHS[lang][monthIndex]!;
  if (lang === "uz") return `${day}-${m}`;
  if (lang === "en") return `${m} ${day}`;
  return `${day} ${m}`;
}
