import { Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const digits = (v: string) => v.replace(/[^\d+]/g, "");

/** Contacts-app action row: call, WhatsApp, email, website — only the ones we have details for. */
export function ContactActions({ phone, whatsapp, email, website }: { phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null }) {
  const wa = whatsapp ?? phone;
  const items = [
    { label: "call", icon: Phone, href: phone ? `tel:${digits(phone)}` : null },
    { label: "whatsapp", icon: MessageCircle, href: wa ? `https://wa.me/${digits(wa).replace(/^\+/, "")}` : null },
    { label: "mail", icon: Mail, href: email ? `mailto:${email}` : null },
    { label: "website", icon: Globe, href: website ? (website.startsWith("http") ? website : `https://${website}`) : null },
  ].filter((i): i is typeof i & { href: string } => !!i.href);
  // Nothing to reach them by: show nothing rather than a row of greyed-out buttons.
  if (items.length === 0) return null;
  return (
    <div className={cn("mb-6 grid gap-2", ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"][items.length - 1])}>
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href}
          target={i.label === "website" || i.label === "whatsapp" ? "_blank" : undefined}
          rel="noreferrer"
          className="press flex h-[56px] flex-col items-center justify-center gap-1 rounded-[12px] bg-bg-elevated text-accent"
        >
          <i.icon className="h-5 w-5" />
          <span className="text-caption2 font-medium">{i.label}</span>
        </a>
      ))}
    </div>
  );
}
