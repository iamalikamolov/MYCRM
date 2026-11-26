"use client";

import {
  CalendarCheck,
  Check,
  ClipboardCopy,
  ClipboardPen,
  HandCoins,
  MessageCircle,
  LayoutGrid,
  List,
  Lock,
  Moon,
  Phone,
  PhoneCall,
  Plus,
  Settings,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatLong, today } from "@/lib/date";
import { copyText, reportsToMarkdown } from "@/lib/notion";
import { computeStats, pct } from "@/lib/plan";
import { computeSales, formatPhone, usd } from "@/lib/sales";
import { useAuth } from "@/store/useAuth";
import { useDashboard } from "@/store/useDashboard";
import { GLASS_DEFAULT, applyAppearance, useTheme } from "@/store/useTheme";
import { AuthGate } from "./AuthGate";
import { DailyReportForm } from "./DailyReportForm";
import { DailyRoutine } from "./DailyRoutine";
import { FeedbackNotes } from "./FeedbackNotes";
import { MonthlyPlan } from "./MonthlyPlan";
import { NotionReportTable } from "./NotionReportTable";
import { PipelineBoard } from "./PipelineBoard";
import { ProspectForm, Prospects } from "./Prospects";
import { SalesView } from "./SalesView";
import { Avatar, ProfileSheet } from "./ProfileSheet";
import { ContactLinks } from "./ContactLinks";
import { DebtsView } from "./DebtsView";
import { ContactDialog } from "./StageActions";
import { stageOf } from "@/lib/pipeline";
import type { Prospect } from "@/lib/types";
import { Modal, SettingsSheet } from "./SettingsSheet";
import { PointerFX } from "./motion";
import { GlassCard, ProgressBar, Toaster, cn, toast } from "./ui";
import { prefersReducedMotion, withViewTransition } from "@/lib/motion";
import { useLang, useT } from "@/locales";
import { WeeklyPlan } from "./WeeklyPlan";

// ─── Views ───────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: "umumiy", label: "Umumiy", icon: LayoutGrid },
  { id: "prospektlar", label: "Prospektlar", icon: Users },
  { id: "kun", label: "Kun tartibi", icon: CalendarCheck },
  { id: "hisobot", label: "Hisobot", icon: ClipboardPen },
  { id: "sotuvlar", label: "Sotuvlar", icon: TrendingUp },
  { id: "qarzlar", label: "Qarzlar", icon: HandCoins },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

function readHash(): ViewId {
  const h = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return (VIEWS.find((v) => v.id === h)?.id ?? "umumiy") as ViewId;
}

const viewIndex = (v: ViewId) => VIEWS.findIndex((x) => x.id === v);

function useView(): [ViewId, (v: ViewId) => void, number] {
  const [view, setViewRaw] = useState<ViewId>("umumiy");
  const [dir, setDir] = useState(0);
  const setView = useCallback((next: ViewId) => {
    setViewRaw((prev) => {
      setDir(Math.sign(viewIndex(next) - viewIndex(prev)));
      return next;
    });
  }, []);
  useEffect(() => {
    setView(readHash());
    const on = () => setView(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [setView]);
  const go = useCallback((v: ViewId) => {
    if (v !== readHash()) history.pushState(null, "", `#${v}`);
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setView]);
  return [view, go, dir];
}

// ─── Sliding pill tabs ───────────────────────────────────────────────────────
// Same technique as the reference video: a second copy of the tab row, painted in the
// "active" colours, sits on top and is cut out with clip-path. Animating the clip's left
// and right edges separately — the leading edge fast (0.36s, power3.out), the trailing
// edge slower (0.55s, power3.inOut) — makes the pill stretch and then catch up, and the
// label colour changes exactly where the pill is, mid-letter.
const easeOut3 = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut3 = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const LEAD_MS = 360;
const TRAIL_MS = 550;

function TabInner({ v, badge, label }: { v: (typeof VIEWS)[number]; badge?: number; label: string }) {
  return (
    <>
      <v.icon size={14} />
      {label}
      {!!badge && (
        <span
          key={badge}
          className="pop tabular grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-bold"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {badge}
        </span>
      )}
    </>
  );
}

const TAB_CLASS = "flex h-9 flex-none items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap";

function SlidingTabs({ view, onChange, badges }: { view: ViewId; onChange: (v: ViewId) => void; badges: Partial<Record<ViewId, number>> }) {
  const t = useT();
  const row = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const refs = useRef<Partial<Record<ViewId, HTMLButtonElement | null>>>({});
  const edges = useRef<{ l: number; r: number } | null>(null);
  const raf = useRef(0);

  const paint = (e: { l: number; r: number }) => {
    if (overlay.current) overlay.current.style.clipPath = `inset(0px ${e.r.toFixed(2)}px 0px ${e.l.toFixed(2)}px round 999px)`;
  };

  const slideTo = useCallback(
    (animate: boolean) => {
      const el = refs.current[view];
      const o = overlay.current;
      if (!el || !o) return;
      const to = { l: el.offsetLeft, r: o.offsetWidth - el.offsetLeft - el.offsetWidth };
      cancelAnimationFrame(raf.current);
      const from = edges.current;
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: animate ? "smooth" : "auto" });
      if (!animate || !from || prefersReducedMotion()) {
        edges.current = to;
        paint(to);
        return;
      }
      const forward = to.l > from.l;
      const start = performance.now();
      const step = (now: number) => {
        const ms = now - start;
        const lead = easeOut3(Math.min(1, ms / LEAD_MS));
        const trail = easeInOut3(Math.min(1, ms / TRAIL_MS));
        // Moving right, the right edge leads; moving left, the left edge leads.
        const kl = forward ? trail : lead;
        const kr = forward ? lead : trail;
        const cur = { l: from.l + (to.l - from.l) * kl, r: from.r + (to.r - from.r) * kr };
        edges.current = cur;
        paint(cur);
        if (ms < TRAIL_MS) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    },
    [view],
  );

  useLayoutEffect(() => slideTo(edges.current !== null), [slideTo]);
  // Labels change width when the language changes: snap without animating.
  useLayoutEffect(() => slideTo(false), [t]); // eslint-disable-line react-hooks/exhaustive-deps
  // One long-lived observer (re-creating it per tab switch would fire its initial
  // callback and snap the pill, killing the slide). It reads the latest slideTo via a ref.
  const slideRef = useRef(slideTo);
  slideRef.current = slideTo;
  useEffect(() => {
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      slideRef.current(false);
    });
    if (row.current) ro.observe(row.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <nav aria-label={t("Bo'limlar")} className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div ref={row} className="relative flex w-max items-center gap-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            ref={(el) => {
              refs.current[v.id] = el;
            }}
            type="button"
            onClick={() => onChange(v.id)}
            aria-current={v.id === view ? "page" : undefined}
            className={`${TAB_CLASS} text-2 transition-colors hover:text-[var(--text)]`}
          >
            <TabInner v={v} badge={badges[v.id]} label={t(v.label)} />
          </button>
        ))}
        {/* Active copy, revealed only inside the pill. */}
        <div
          ref={overlay}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex w-max items-center gap-0.5"
          style={{
            background: "linear-gradient(180deg, color-mix(in srgb, var(--tab-active-bg) 92%, #fff), var(--tab-active-bg))",
            color: "var(--tab-active-text)",
            clipPath: "inset(0px 100% 0px 0px round 999px)",
          }}
        >
          {VIEWS.map((v) => (
            <span key={v.id} className={TAB_CLASS}>
              <TabInner v={v} badge={badges[v.id]} label={t(v.label)} />
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ─── Glass adjust popover ────────────────────────────────────────────────────
function GlassAdjust() {
  const [open, setOpen] = useState(false);
  const { glassBlur, glassAlpha, setGlass, resetGlass } = useTheme();
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" className="btn btn-glass h-9 px-3" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("Shishani sozlash")}>
        <SlidersHorizontal size={14} />
        <span className="hidden xl:inline">{t("Shisha")}</span>
      </button>
      {open && (
        <div className="glass fade-in absolute top-12 right-0 z-50 w-64 rounded-[20px] p-4">
          <label className="block">
            <span className="flex justify-between text-[12px] font-semibold">
              <span>{t("Xiralik (blur)")}</span>
              <span className="tabular text-3">{glassBlur}px</span>
            </span>
            <input type="range" min={8} max={48} value={glassBlur} onChange={(e) => setGlass({ glassBlur: Number(e.target.value) })} className="mt-2 w-full accent-[var(--accent)]" />
          </label>
          <label className="mt-3 block">
            <span className="flex justify-between text-[12px] font-semibold">
              <span>{t("Shaffoflik")}</span>
              <span className="tabular text-3">{Math.round((1 - glassAlpha) * 100)}%</span>
            </span>
            <input
              type="range"
              min={15}
              max={80}
              value={Math.round(glassAlpha * 100)}
              onChange={(e) => setGlass({ glassAlpha: Number(e.target.value) / 100 })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </label>
          <button
            type="button"
            className="text-3 mt-3 text-[12px] hover:underline"
            onClick={resetGlass}
            disabled={glassBlur === GLASS_DEFAULT.blur && glassAlpha === GLASS_DEFAULT.alpha}
          >
            {t("Standartga qaytarish")}
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const dark = theme === "dark";
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="glass-chip grid size-9 place-items-center"
      aria-label={dark ? t("Yorug' rejimga o'tish") : t("Qorong'i rejimga o'tish")}
      title={dark ? t("Yorug' shisha") : t("Qorong'i shisha")}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function TopBar({
  view,
  onView,
  badges,
  onSettings,
  onProfile,
}: {
  view: ViewId;
  onView: (v: ViewId) => void;
  badges: Partial<Record<ViewId, number>>;
  onSettings: () => void;
  onProfile: () => void;
}) {
  const profile = useDashboard((s) => s.profile);
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const t = useT();
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <div className="glass mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 rounded-[24px] p-2 lg:flex-nowrap lg:rounded-full">
        <button
          type="button"
          onClick={onProfile}
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-0.5 pr-3 pl-0.5 text-left transition-colors hover:bg-[var(--track)] lg:flex-none"
          aria-label={t("Profilni tahrirlash")}
          title={t("Profilni tahrirlash")}
        >
          <span className="transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
            <Avatar size={36} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">{name || t("Mijoz topish")}</span>
            <span className="text-3 block truncate text-[11px]">{formatLong(today())}</span>
          </span>
        </button>
        <div className="order-last w-full lg:order-none lg:mx-auto lg:w-auto">
          <div className="glass-chip p-1">
            <SlidingTabs view={view} onChange={onView} badges={badges} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <GlassAdjust />
          <ThemeToggle />
          <button type="button" onClick={onSettings} className="glass-chip grid size-9 place-items-center" aria-label={t("Sozlamalar (parol, avto-qulflash)")} title={t("Sozlamalar")}>
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Side rail ───────────────────────────────────────────────────────────────
function SideRail({ onAdd, onView, onSettings }: { onAdd: () => void; onView: (v: ViewId) => void; onSettings: () => void }) {
  const lock = useAuth((s) => s.lock);
  const reports = useDashboard((s) => s.reports);
  const t = useT();
  const items = [
    { icon: Plus, label: t("Yangi mijoz"), onClick: onAdd, primary: true },
    { icon: PhoneCall, label: t("Qo'ng'iroq navbati"), onClick: () => onView("umumiy") },
    { icon: Users, label: t("Prospektlar"), onClick: () => onView("prospektlar") },
    { icon: ClipboardPen, label: t("Kunlik hisobot"), onClick: () => onView("hisobot") },
    {
      icon: ClipboardCopy,
      label: t("Jadvalni Notionga nusxalash"),
      onClick: async () => {
        if (await copyText(reportsToMarkdown(reports))) toast(t("Hisobot jadvali nusxalandi — Notionga joylang"));
      },
    },
    { icon: Lock, label: t("Qulflash"), onClick: lock },
    { icon: Settings, label: t("Sozlamalar"), onClick: onSettings },
  ];
  return (
    <aside
      className="glass fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full p-1.5 md:top-1/2 md:bottom-auto md:left-4 md:translate-x-0 md:-translate-y-1/2 md:flex-col"
      aria-label={t("Tezkor amallar")}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          aria-label={it.label}
          className={cn(
            "group relative grid size-10 place-items-center rounded-full transition-all duration-200 active:scale-90",
            it.primary ? "" : "text-2 hover:bg-[var(--track)] hover:text-[var(--text)]",
          )}
          style={it.primary ? { background: "var(--tab-active-bg)", color: "var(--tab-active-text)" } : undefined}
        >
          <it.icon size={17} />
          <span className="glass-chip pointer-events-none absolute left-full ml-3 hidden px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 md:block">
            {it.label}
          </span>
        </button>
      ))}
    </aside>
  );
}

// ─── Overview widgets ────────────────────────────────────────────────────────
function CallQueue({ onView }: { onView: (v: ViewId) => void }) {
  const prospects = useDashboard((s) => s.prospects);
  const move = useDashboard((s) => s.moveProspect);
  const queue = prospects.filter((p) => stageOf(p) === "new");
  const t = useT();
  const [contacting, setContacting] = useState<Prospect | null>(null);
  return (
    <GlassCard
      icon={MessageCircle}
      iconTone="var(--accent)"
      eyebrow={t("Bugun")}
      title={t("Bog'lanish kerak")}
      subtitle={t("{n} ta mijoz bog'lanishni kutmoqda", { n: queue.length })}
      actions={
        <button type="button" className="btn btn-glass h-8 px-3 text-[12px]" onClick={() => onView("prospektlar")}>
          {t("Hammasi")}
        </button>
      }
    >
      <ul className="flex flex-col">
        {queue.length === 0 && <li className="text-3 py-8 text-center text-[13px]">{t("Hammasi bilan bog'lanilgan 🎉")}</li>}
        {queue.slice(0, 7).map((p) => (
          <li key={p.id} className="hairline flex items-center gap-3 border-b py-2.5 last:border-b-0" style={{ viewTransitionName: `q-${p.id}` }}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">
                {p.firstName} {p.lastName}
              </div>
              <div className="text-3 truncate text-[12px]">
                {p.niche || "—"}
              </div>
            </div>
            {p.phone ? (
              <a href={`tel:${p.phone}`} className="btn btn-glass tabular h-8 px-3 text-[12px]">
                <Phone size={13} />
                <span className="hidden sm:inline">{formatPhone(p.phone)}</span>
              </a>
            ) : (
              <ContactLinks p={p} limit={1} className="text-[12px]" />
            )}
            <button
              type="button"
              className="btn h-8 px-3 text-[12px]"
              style={{ background: "color-mix(in srgb, var(--green) 16%, transparent)", color: "var(--green)" }}
              onClick={() => setContacting(p)}
            >
              <Check size={13} strokeWidth={3} />
              {t("Bog'landim")}
            </button>
            <button
              type="button"
              className="btn h-8 px-2.5 text-[12px]"
              style={{ background: "color-mix(in srgb, var(--red) 14%, transparent)", color: "var(--red)" }}
              title={t("Rad etdi")}
              aria-label={t("{name}: rad etdi", { name: p.firstName })}
              onClick={() => {
                withViewTransition(() => move(p.id, "lost"));
                toast(t("{name} «Rad etdi» bo'limiga o'tdi", { name: p.firstName }));
              }}
            >
              <X size={13} strokeWidth={2.6} />
              <span className="hidden sm:inline">{t("Rad")}</span>
            </button>
          </li>
        ))}
      </ul>
      <ContactDialog prospect={contacting} onClose={() => setContacting(null)} />
    </GlassCard>
  );
}

function TodayCard({ onView }: { onView: (v: ViewId) => void }) {
  const routine = useDashboard((s) => s.routine);
  const reports = useDashboard((s) => s.reports);
  const done = routine.filter((r) => r.done).length;
  const p = pct(done, routine.length);
  const hasReport = reports.some((r) => r.date === today());
  const next = routine.find((r) => !r.done);
  const t = useT();
  return (
    <GlassCard icon={CalendarCheck} iconTone="var(--green)" eyebrow={t("Kun tartibi")} title={t("{p}% bajarildi", { p })} subtitle={t("{done}/{total} blok", { done, total: routine.length })}>
      <ProgressBar value={p} from="var(--green)" to="var(--green)" label={t("Kun tartibi")} />
      {next && (
        <div className="glass-strong mt-4 p-3.5">
          <div className="label">{t("Keyingi blok")}</div>
          <div className="mt-1 text-[14px] font-semibold">
            <span className="tabular text-3 mr-2">{next.time}</span>
            {next.title}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-glass" onClick={() => onView("kun")}>
          {t("Kun tartibini ochish")}
        </button>
        <button type="button" className={hasReport ? "btn btn-glass" : "btn btn-primary"} onClick={() => onView("hisobot")}>
          {hasReport ? <Check size={14} /> : <ClipboardPen size={14} />}
          {hasReport ? t("Hisobot yozilgan") : t("Kunlik hisobot yozish")}
        </button>
      </div>
    </GlassCard>
  );
}

function PageTitle({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="fade-in flex flex-wrap items-end justify-between gap-3 px-1">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">{title}</h1>
        <p className="text-2 mt-1 text-[14px]">{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
function useAppearance() {
  const theme = useTheme((s) => s.theme);
  const glassBlur = useTheme((s) => s.glassBlur);
  const glassAlpha = useTheme((s) => s.glassAlpha);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.all([useTheme.persist.rehydrate(), useLang.persist.rehydrate()]).then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) applyAppearance({ theme, glassBlur, glassAlpha });
  }, [ready, theme, glassBlur, glassAlpha]);
}

function App() {
  const [view, setView, dir] = useView();
  const t = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [boardMode, setBoardMode] = useState<"board" | "list">("board");
  const plan = useDashboard((s) => s.plan);
  const reports = useDashboard((s) => s.reports);
  const prospects = useDashboard((s) => s.prospects);
  const stats = useMemo(() => computeStats(plan, reports), [plan, reports]);
  const sales = useMemo(() => computeSales(plan, prospects), [plan, prospects]);
  const badges = { prospektlar: sales.waitingContact, hisobot: stats.todayReport ? 0 : 1, qarzlar: sales.debtors };

  return (
    <>
      <TopBar view={view} onView={setView} badges={badges} onSettings={() => setSettingsOpen(true)} onProfile={() => setProfileOpen(true)} />
      <SideRail onAdd={() => setAddOpen(true)} onView={setView} onSettings={() => setSettingsOpen(true)} />

      <main key={view} style={{ "--dir": dir } as React.CSSProperties} className="view-enter mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-5 px-3 pt-6 pb-28 sm:px-5 md:pb-16 md:pl-20">
        {view === "umumiy" && (
          <>
            <MonthlyPlan stats={stats} sales={sales} />
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <CallQueue onView={setView} />
              <TodayCard onView={setView} />
            </div>
          </>
        )}

        {view === "prospektlar" && (
          <>
            <PageTitle
              title={t("Prospektlar")}
              subtitle={t("Topilgan mijozlar: yangi → bog'lanildi → jarayonda → sotildi. Kartani ustunlar orasida sudrang yoki tugmani bosing.")}
              actions={
                <div className="flex items-center gap-2">
                  <div className="glass-chip flex p-1">
                    {(
                      [
                        ["board", LayoutGrid, t("Doska")],
                        ["list", List, t("Ro'yxat")],
                      ] as const
                    ).map(([m, Icon, l]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBoardMode(m)}
                        aria-pressed={boardMode === m}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
                        style={boardMode === m ? { background: "var(--tab-active-bg)", color: "var(--tab-active-text)" } : { color: "var(--text-2)" }}
                      >
                        <Icon size={13} />
                        {l}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
                    <UserPlus size={15} />
                    {t("Yangi mijoz")}
                  </button>
                </div>
              }
            />
            {boardMode === "board" ? <PipelineBoard /> : <Prospects sales={sales} />}
          </>
        )}

        {view === "kun" && (
          <>
            <PageTitle title={t("Kun tartibi")} subtitle={t("Haftalik plan va bugungi ish bloklari")} />
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <DailyRoutine />
              <WeeklyPlan stats={stats} />
            </div>
          </>
        )}

        {view === "hisobot" && (
          <>
            <PageTitle title={t("Hisobot")} subtitle={t("Kun yakunidagi hisobot, mulohazalar va Notion jadvali")} />
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <DailyReportForm dailyQuota={stats.dailyQuota} />
              <FeedbackNotes />
            </div>
            <NotionReportTable />
          </>
        )}

        {view === "qarzlar" && (
          <>
            <PageTitle title={t("Qarz varaqasi")} subtitle={t("Kim qancha qarz, qancha to'ladi — bir joyda")} />
            <DebtsView sales={sales} />
          </>
        )}

        {view === "sotuvlar" && (
          <>
            <PageTitle title={t("Sotuvlar")} subtitle={t("Qilgan sotuvlaringiz: summa, konversiya va xizmatlar kesimida")} />
            <SalesView sales={sales} />
          </>
        )}
      </main>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t("Yangi mijoz")} icon={UserPlus}>
        <ProspectForm editing={null} onDone={() => setAddOpen(false)} />
        <p className="text-3 mt-3 text-[12px]">{t("Qo'shilgan mijoz «Prospektlar → Yangi» ustuniga tushadi. Bir nechtasini ketma-ket qo'shishingiz mumkin.")}</p>
      </Modal>
    </>
  );
}

export function Dashboard() {
  useAppearance();
  return (
    <>
      <PointerFX />
      <AuthGate>
        <App />
      </AuthGate>
      <Toaster />
    </>
  );
}

