import { addDays, isWorkday, startOfWeek, today } from "@/lib/date";
import { autoStatus } from "@/lib/plan";
import type { DailyReport, FeedbackNote, PlanSettings, Prospect, RoutineItem, WeeklyCommitment } from "@/lib/types";

export function sampleProspects(): Prospect[] {
  const t = today();
  const d = (n: number) => addDays(t, -n);
  const base = { note: "", proposalAt: null, calledAt: null, outcome: "open", wonAt: null, amount: 0, service: null } as const;
  const list: Omit<Prospect, "id">[] = [
    { ...base, firstName: "Jasur", lastName: "Karimov", phone: "+998901234567", instagram: "smile.dental.uz", niche: "Stomatologiya", createdAt: t, note: "Smile Dental egasi, Instagramdan topildi" },
    { ...base, firstName: "Dilnoza", lastName: "Rahimova", phone: "+998935551122", telegram: "bilimplus_admin", email: "info@bilimplus.uz", niche: "O'quv markazi", createdAt: t, proposalAt: t, contactedAt: t, contactChannel: "telegram" },
    { ...base, firstName: "Sardor", lastName: "Tursunov", phone: "+998977003344", niche: "Mebel", createdAt: d(1), proposalAt: d(1), calledAt: t, contactedAt: d(1), contactChannel: "call", note: "Direktor dushanba qaytadi" },
    { ...base, firstName: "Malika", lastName: "Yusupova", phone: "+998998887766", niche: "Go'zallik saloni", createdAt: d(2), proposalAt: d(2), calledAt: d(1), outcome: "lost" },
    { ...base, firstName: "Bekzod", lastName: "Aliyev", phone: "+998946667788", niche: "Logistika", createdAt: d(3), proposalAt: d(3), calledAt: d(2), contactedAt: d(3), contactChannel: "whatsapp", inProgressAt: d(1), note: "Mini App demo versiyasini sinab ko'ryapti" },
    { ...base, firstName: "Nodira", lastName: "Xolmatova", phone: "+998901112233", niche: "Stomatologiya", createdAt: d(6), proposalAt: d(6), calledAt: d(5), outcome: "won", wonAt: d(2), amount: 450, service: "Telegram Bot" },
    { ...base, firstName: "Otabek", lastName: "Saidov", phone: "+998933334455", niche: "O'quv markazi", createdAt: d(9), proposalAt: d(9), calledAt: d(8), outcome: "won", wonAt: d(5), amount: 300, service: "Landing Page" },
    { ...base, firstName: "Kamola", lastName: "Ergasheva", phone: "+998977778899", niche: "Restoran", createdAt: d(10), proposalAt: d(10), calledAt: d(9), outcome: "won", wonAt: d(7), amount: 900, service: "Telegram Mini App", payments: [{ id: uid(), date: d(7), amount: 300 }, { id: uid(), date: d(2), amount: 200 }] },
  ];
  return list.map((p) => ({ ...p, id: uid() }));
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Sample data is generated relative to today so the plan always looks "in progress" on first open. */
export function samplePlan(): PlanSettings {
  return {
    // The plan started on Monday two weeks ago → today is in week 3 of 4.
    startDate: addDays(startOfWeek(today()), -14),
    monthlyTarget: 80,
    weeks: 4,
    autoWeekly: true,
    weeklyTarget: 20,
    workdaysPerWeek: 5,
    autoDaily: true,
    dailyQuota: 4,
    callCoveragePct: 100,
  };
}

export const SAMPLE_NICHES = ["Stomatologiya klinikalari", "O'quv markazlari", "Mebel do'konlari", "Go'zallik salonlari"];

export function sampleCommitments(): WeeklyCommitment[] {
  return [
    { id: uid(), text: "20 ta mijozga taklif (proposal) yuborish", done: false },
    { id: uid(), text: "Taklif yuborilgan har bir prospektga qo'ng'iroq qilish", done: false },
    { id: uid(), text: "Har bir qo'ng'iroqdan keyin mulohazani Notionga yozish", done: true },
    { id: uid(), text: "Notion hisobot jadvalini har kuni yangilash", done: true },
    { id: uid(), text: "Juma: hafta natijalarini tahlil qilish va keyingi haftani rejalash", done: false },
  ];
}

export function sampleRoutine(): RoutineItem[] {
  const items: Omit<RoutineItem, "id">[] = [
    { time: "08:30", durationMin: 30, title: "Kun rejasini ko'rib chiqish, Notionni ochish", done: true },
    { time: "09:00", durationMin: 60, title: "Prospektlarni topish (Instagram, 2GIS, Telegram)", done: true },
    { time: "10:00", durationMin: 90, title: "4–5 ta shaxsiy taklif tayyorlash va yuborish", done: true },
    { time: "11:30", durationMin: 60, title: "Taklif yuborilgan har bir prospektga qo'ng'iroq", done: false },
    { time: "12:30", durationMin: 15, title: "Mulohazalarni Notionga yozish", done: false },
    { time: "13:00", durationMin: 60, title: "Tushlik va dam olish", done: false },
    { time: "14:00", durationMin: 180, title: "Build / Delivery bloki (joriy loyihalar)", done: false },
    { time: "17:00", durationMin: 30, title: "Kechki follow-up xabarlari", done: false },
    { time: "17:30", durationMin: 20, title: "Kunlik hisobot va Notion jadvalini yangilash", done: false },
  ];
  return items.map((i) => ({ ...i, id: uid() }));
}

const FEEDBACK_POOL = [
  "Narx qimmatroq deyishdi, chegirma so'rashdi",
  "Landing sahifa kerak, keyingi hafta qaror qilishadi",
  "Telegram bot g'oyasi yoqdi, demo so'rashdi",
  "Hozircha budjet yo'q, 1 oydan keyin qayta qo'ng'iroq",
  "Egasi bilan gaplashish kerak, raqam berishdi",
  "Mini App uchun portfolio so'rashdi",
  "Javob bermadi, ertaga qayta urinish",
  "Raqobatchi bilan ishlashyapti, lekin qiziqishdi",
];
const SUMMARY_POOL = [
  "Yaxshi kun, qo'ng'iroqlar samarali o'tdi",
  "Prospekt topish ko'p vaqt oldi",
  "2 ta iliq lid, demo rejalashtirildi",
  "Takliflar shablonini yangiladim",
  "Delivery ko'p vaqt oldi, takliflar kam bo'ldi",
];

/** Deterministic pseudo-random so the sample doesn't jump around between reloads before persisting. */
function seeded(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function sampleReports(plan: PlanSettings, quota: number): DailyReport[] {
  const out: DailyReport[] = [];
  const t = today();
  for (let d = plan.startDate, i = 0; d < t; d = addDays(d, 1), i++) {
    if (!isWorkday(d, plan.workdaysPerWeek)) continue;
    const proposals = 2 + Math.floor(seeded(i) * 5); // 2–6
    const calls = Math.max(0, proposals - Math.floor(seeded(i + 50) * 2));
    out.push({
      id: uid(),
      date: d,
      proposals,
      calls,
      feedback: `${FEEDBACK_POOL[i % FEEDBACK_POOL.length]}; ${FEEDBACK_POOL[(i + 3) % FEEDBACK_POOL.length]?.toLowerCase()}`,
      summary: SUMMARY_POOL[i % SUMMARY_POOL.length] ?? "",
      status: autoStatus(proposals, quota),
    });
  }
  return out;
}

export function sampleNotes(): FeedbackNote[] {
  const t = today();
  return [
    { id: uid(), date: t, client: "Smile Dental", niche: "Stomatologiya", kind: "interest", text: "Onlayn yozilish uchun Telegram bot kerak. Ertaga 15:00 da demo ko'rsatamiz.", syncedToNotion: false },
    { id: uid(), date: t, client: "Bilim Plus", niche: "O'quv markazi", kind: "objection", text: "\"Instagram yetarli\" deyishdi. Landing konversiya statistikasini yuborish kerak.", syncedToNotion: false },
    { id: uid(), date: addDays(t, -1), client: "Comfort Mebel", niche: "Mebel", kind: "callback", text: "Direktor safarda, dushanba kuni qayta qo'ng'iroq qilish.", syncedToNotion: true },
    { id: uid(), date: addDays(t, -1), client: "Lola Beauty", niche: "Go'zallik saloni", kind: "rejected", text: "Hozir tayyor bot ishlatishyapti, yangi tizimga o'tishni xohlamaydi.", syncedToNotion: true },
    { id: uid(), date: addDays(t, -2), client: "Express Kargo", niche: "Logistika", kind: "interest", text: "Mini App orqali buyurtma kuzatish g'oyasi yoqdi. Narx taklifini kutishyapti.", syncedToNotion: true },
  ];
}
