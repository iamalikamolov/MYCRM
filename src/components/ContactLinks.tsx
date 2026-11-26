"use client";

import { Mail, MessageCircle, Phone, Send } from "lucide-react";
import { instagramUrl, mailtoUrl, telegramUrl } from "@/lib/contacts";
import { formatPhone } from "@/lib/sales";
import type { Prospect } from "@/lib/types";
import { cn } from "./ui";

/** Simple camera-glyph icon for Instagram (lucide has no brand icons). */
export function InstagramIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

type Channel = { kind: "phone" | "whatsapp" | "instagram" | "telegram" | "email"; href: string; label: string; external: boolean };

export function channelsOf(p: Pick<Prospect, "phone" | "instagram" | "telegram" | "email">): Channel[] {
  const out: Channel[] = [];
  if (p.phone) out.push({ kind: "phone", href: `tel:${p.phone}`, label: formatPhone(p.phone), external: false });
  if (p.phone) out.push({ kind: "whatsapp", href: `https://wa.me/${p.phone.replace(/\D/g, "")}`, label: "WhatsApp", external: true });
  if (p.instagram) out.push({ kind: "instagram", href: instagramUrl(p.instagram), label: `@${p.instagram}`, external: true });
  if (p.telegram) out.push({ kind: "telegram", href: telegramUrl(p.telegram), label: `@${p.telegram}`, external: true });
  if (p.email) out.push({ kind: "email", href: mailtoUrl(p.email), label: p.email, external: false });
  return out;
}

export function ChannelIcon({ kind, size = 12 }: { kind: Channel["kind"]; size?: number }) {
  if (kind === "phone") return <Phone size={size} />;
  if (kind === "whatsapp") return <MessageCircle size={size} />;
  if (kind === "instagram") return <InstagramIcon size={size} />;
  if (kind === "telegram") return <Send size={size} />;
  return <Mail size={size} />;
}

/** Clickable contact links (call / open Instagram / open Telegram / write email). */
export function ContactLinks({ p, className, limit }: { p: Pick<Prospect, "phone" | "instagram" | "telegram" | "email">; className?: string; limit?: number }) {
  const list = channelsOf(p).slice(0, limit);
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5", className)}>
      {list.map((c) => (
        <a
          key={c.kind}
          href={c.href}
          {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          onClick={(e) => e.stopPropagation()}
          className="tabular flex min-w-0 items-center gap-1 font-medium hover:underline"
          style={{ color: "var(--accent)" }}
        >
          <ChannelIcon kind={c.kind} />
          <span className="truncate">{c.label}</span>
        </a>
      ))}
    </span>
  );
}
