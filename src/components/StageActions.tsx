"use client";

import { Mail, MessageCircle, MoreHorizontal, Phone, Send, Users } from "lucide-react";
import type { ComponentType } from "react";
import { withViewTransition } from "@/lib/motion";
import type { ContactChannel, Prospect } from "@/lib/types";
import { type TFn, useT } from "@/locales";
import { useDashboard } from "@/store/useDashboard";
import { InstagramIcon } from "./ContactLinks";
import { Modal } from "./SettingsSheet";
import { toast } from "./ui";

export const CHANNELS: { id: ContactChannel; icon: ComponentType<{ size?: number }>; tone: string }[] = [
  { id: "call", icon: Phone, tone: "var(--green)" },
  { id: "telegram", icon: Send, tone: "#2aa3e0" },
  { id: "instagram", icon: InstagramIcon, tone: "#d6407d" },
  { id: "whatsapp", icon: MessageCircle, tone: "#25b862" },
  { id: "email", icon: Mail, tone: "var(--accent)" },
  { id: "meeting", icon: Users, tone: "var(--purple)" },
  { id: "other", icon: MoreHorizontal, tone: "var(--text-2)" },
];

export function channelLabel(c: ContactChannel, t: TFn): string {
  switch (c) {
    case "call":
      return t("Qo'ng'iroq|channel");
    case "telegram":
      return "Telegram";
    case "instagram":
      return "Instagram";
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return t("Email");
    case "meeting":
      return t("Uchrashuv");
    default:
      return t("Boshqa");
  }
}

export function ChannelBadgeIcon({ channel, size = 12 }: { channel: ContactChannel; size?: number }) {
  const c = CHANNELS.find((x) => x.id === channel) ?? CHANNELS[CHANNELS.length - 1]!;
  return (
    <span style={{ color: c.tone }} className="inline-flex">
      <c.icon size={size} />
    </span>
  );
}

/** "How did you reach them?" — one tap on a channel moves the client to "Bog'lanildi". */
export function ContactDialog({ prospect, onClose }: { prospect: Prospect | null; onClose: () => void }) {
  const t = useT();
  const markContacted = useDashboard((s) => s.markContacted);
  // Suggest the channels this client actually has first.
  const has: Partial<Record<ContactChannel, boolean>> = prospect
    ? { call: !!prospect.phone, whatsapp: !!prospect.phone, telegram: !!prospect.telegram, instagram: !!prospect.instagram, email: !!prospect.email }
    : {};
  return (
    <Modal open={!!prospect} onClose={onClose} title={t("Qanday bog'landingiz?")} icon={MessageCircle}>
      {prospect && (
        <>
          <p className="text-2 -mt-2 mb-4 text-[13.5px] font-semibold">
            {prospect.firstName} {prospect.lastName}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  withViewTransition(() => markContacted(prospect.id, c.id));
                  toast(t("{name}: bog'lanildi ✓", { name: prospect.firstName }));
                  onClose();
                }}
                className="btn btn-glass h-14 flex-col gap-1 rounded-2xl text-[12.5px]"
                style={has[c.id] ? { boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${c.tone} 55%, transparent)` } : undefined}
              >
                <span style={{ color: c.tone }}>
                  <c.icon size={18} />
                </span>
                {channelLabel(c.id, t)}
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
