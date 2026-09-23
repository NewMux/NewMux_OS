import { Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const digits = (v: string) => v.replace(/[^\d+]/g, "");

/** Contacts-app action row: call, WhatsApp, email, website — one tap each. */
export function ContactActions({ phone, whatsapp, email, website }: { phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null }) {
  const wa = whatsapp ?? phone;
  const items = [
    { label: "call", icon: Phone, href: phone ? `tel:${digits(phone)}` : null },
    { label: "whatsapp", icon: MessageCircle, href: wa ? `https://wa.me/${digits(wa).replace(/^\+/, "")}` : null },
    { label: "mail", icon: Mail, href: email ? `mailto:${email}` : null },
    { label: "website", icon: Globe, href: website ? (website.startsWith("http") ? website : `https://${website}`) : null },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((i) => {
        const inner = (
          <>
            <i.icon className="h-5 w-5" />
            <span className="text-caption2 font-medium">{i.label}</span>
          </>
        );
        const cls = cn("flex h-[60px] flex-col items-center justify-center gap-1 rounded-[12px] bg-bg-elevated", i.href ? "press text-accent" : "text-label-3");
        return i.href ? (
          <a key={i.label} href={i.href} target={i.label === "website" || i.label === "whatsapp" ? "_blank" : undefined} rel="noreferrer" className={cls}>
            {inner}
          </a>
        ) : (
          <span key={i.label} aria-disabled className={cls}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}
