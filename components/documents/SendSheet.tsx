"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, Mail, MessageCircle } from "lucide-react";
import { Sheet, SheetIconButton } from "@/components/ui/Sheet";
import { ListRow, ListSection } from "@/components/ui/List";
import { Textarea } from "@/components/ui/Input";
import { DOC_TYPE } from "@/lib/labels";
import type { DocumentType } from "@/lib/data/types";

/**
 * Sends an issued document (PRD addendum 1.2, section 3, step 7): a link to
 * the signed PDF by email or WhatsApp, or the PDF itself. The send time and
 * channel are recorded on the document; the link stops working if it's
 * voided.
 */
export function SendSheet({
  open,
  onOpenChange,
  doc,
  shareUrl,
  to,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: { id: string; type: DocumentType; documentNumber: string; title: string | null };
  shareUrl: string;
  to: { name: string; contactName?: string | null; email?: string | null; whatsapp?: string | null };
}) {
  const router = useRouter();
  const what = DOC_TYPE[doc.type].toLowerCase();
  const greeting = to.contactName ? `Dear ${to.contactName.split(/[\s—-]/)[0]},` : "Hello,";
  const initial = `${greeting}\n\nPlease find our ${what} ${doc.documentNumber}${doc.title ? ` for ${doc.title}` : ""} here:\n${shareUrl}\n\nKind regards,\nNewMux`;
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (open) setText(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Opening mail or WhatsApp has to happen in the tap itself (Safari blocks it after an await), so the record goes in the background.
  const record = (via: "email" | "whatsapp" | "download" | "other") =>
    fetch(`/api/documents/${doc.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ via }) })
      .then(async (r) => {
        if (r.ok) router.refresh();
        else toast.error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't record it as sent.");
      })
      .catch(() => {
        toast.error("Couldn't record it as sent.");
      });
  const phone = to.whatsapp?.replace(/[^\d]/g, "");
  const subject = `${DOC_TYPE[doc.type]} ${doc.documentNumber}${doc.title ? `: ${doc.title}` : ""}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Send" size="auto" left={<SheetIconButton label="Close" onClick={() => onOpenChange(false)} />}>
      <ListSection header={`To ${to.name}`}>
        <div className="px-4 py-3">
          <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </ListSection>
      <ListSection footer="The link opens the signed PDF. It's marked sent with the time and the channel.">
        <ListRow
          leading={<MessageCircle className="h-5 w-5 text-ios-green" />}
          title="WhatsApp"
          subtitle={phone ? to.whatsapp : "Choose the chat in WhatsApp"}
          onClick={() => {
            window.open(`https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
            void record("whatsapp");
            onOpenChange(false);
          }}
          chevron
        />
        <ListRow
          leading={<Mail className="h-5 w-5 text-accent" />}
          title="Email"
          subtitle={to.email ?? "No email on file"}
          onClick={() => {
            window.location.href = `mailto:${to.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
            void record("email");
            onOpenChange(false);
          }}
          chevron
        />
        <ListRow
          leading={<Copy className="h-5 w-5 text-label-2" />}
          title="Copy Link"
          onClick={async () => {
            await navigator.clipboard?.writeText(shareUrl);
            toast.success("Link copied");
            void record("other");
          }}
        />
        <ListRow
          leading={<Download className="h-5 w-5 text-label-2" />}
          title="Download PDF"
          onClick={() => {
            window.location.href = `/api/documents/${doc.id}/pdf?download=1`;
            void record("download");
            onOpenChange(false);
          }}
        />
      </ListSection>
    </Sheet>
  );
}
