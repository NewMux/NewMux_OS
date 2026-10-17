"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenLine, ShieldCheck } from "lucide-react";
import { Sheet, SheetIconButton } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ListSection, PlainRowInput } from "@/components/ui/List";
import { PdfPreview } from "./PdfPreview";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import { blobToBase64, officialData, renderOfficialPdf } from "@/lib/pdf/download";
import { DOC_TYPE, MUST_SIGN } from "@/lib/labels";
import type { DocumentType } from "@/lib/data/types";
import type { OfficialPdfData } from "@/lib/pdf/officialTypes";

export type Signer = { name: string; position: string; userId: string; isActive: boolean } | null;

/**
 * Preview → sign → issue (PRD addendum 1.2, sections 3 and 5). The preview
 * is the real PDF. Signing asks the signatory to draw their signature and
 * enter their password; the server checks both the login and the password,
 * fixes the number, and the PDF made here with the drawing becomes the
 * locked record. The drawing is discarded as soon as it's on the PDF.
 */
export function IssueSheet({
  open,
  onOpenChange,
  doc,
  signer,
  meId,
  draft,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: { id: string; type: DocumentType; documentNumber: string };
  signer: Signer;
  meId: string;
  /** Preview only, for a document that's already issued it shows the stored PDF instead. */
  draft: boolean;
}) {
  const router = useRouter();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [step, setStep] = useState<"preview" | "sign">("preview");
  const [password, setPassword] = useState("");
  const [inked, setInked] = useState(false);
  const [busy, setBusy] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);
  const mustSign = MUST_SIGN.includes(doc.type);
  const mine = !!signer && signer.isActive && signer.userId === meId;

  useEffect(() => {
    if (!open) return;
    setStep("preview");
    setPassword("");
    setBlob(null);
    let cancelled = false;
    (async () => {
      try {
        const pdf = draft
          ? await renderOfficialPdf(await officialData(doc.id))
          : await fetch(`/api/documents/${doc.id}/pdf`, { cache: "no-store" }).then((r) => {
              if (!r.ok) throw new Error("Couldn't load the issued PDF.");
              return r.blob();
            });
        if (!cancelled) setBlob(pdf);
      } catch (e) {
        toast.error((e as Error).message || "Couldn't prepare the preview.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, doc.id, draft]);

  async function issue(sign: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const start = await fetch(`/api/documents/${doc.id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign, password: sign ? password : undefined }),
      });
      const started = (await start.json().catch(() => ({}))) as { token?: string; data?: OfficialPdfData; error?: string };
      if (!start.ok || !started.token || !started.data) throw new Error(started.error ?? "Couldn't start issuing.");
      const signature = sign ? pad.current?.toDataUrl() : null;
      if (sign && !signature) throw new Error("Draw your signature first.");
      const pdf = await renderOfficialPdf(started.data, signature);
      const finish = await fetch(`/api/documents/${doc.id}/issue`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: started.token, pdf: await blobToBase64(pdf) }),
      });
      const done = (await finish.json().catch(() => ({}))) as { document?: { documentNumber: string }; error?: string };
      if (!finish.ok || !done.document) throw new Error(done.error ?? "Couldn't issue it.");
      pad.current?.clear();
      setPassword("");
      toast.success(`${done.document.documentNumber} ${sign ? "signed and issued" : "issued"}`);
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) pad.current?.clear();
        onOpenChange(o);
      }}
      title={step === "sign" ? "Sign and Issue" : draft ? "Preview" : doc.documentNumber}
      left={<SheetIconButton label="Close" onClick={() => onOpenChange(false)} />}
    >
      {step === "preview" ? (
        <>
          <PdfPreview blob={blob} className="-mx-1 mb-5" />
          {draft && (
            <div className="space-y-3">
              {mine ? (
                <Button className="w-full" onClick={() => setStep("sign")} disabled={!blob}>
                  <PenLine className="mr-2 h-5 w-5" /> Sign and Issue
                </Button>
              ) : (
                <p className="rounded-xl bg-fill/[0.1] px-4 py-3 text-subhead text-label-2">
                  {!signer
                    ? `Choose who signs this ${DOC_TYPE[doc.type].toLowerCase()} (Edit) before it can be issued.`
                    : !signer.isActive
                      ? `${signer.name} is no longer an active signatory. Edit it and choose another.`
                      : `Only ${signer.name} can sign as ${signer.name}. Ask them to open this document and sign it, or edit it and choose yourself.`}
                </p>
              )}
              {!mustSign && (
                <Button variant="secondary" className="w-full" onClick={() => void issue(false)} disabled={busy || !blob}>
                  Issue Without Signing
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="pb-4">
          <ListSection header={`Sign as ${signer?.name}`} footer={`${signer?.position}. Your signature goes on this document only; it isn't saved anywhere else.`}>
            <div className="p-3">
              <SignaturePad ref={pad} onChange={(empty) => setInked(!empty)} />
              <div className="mt-2 flex justify-end">
                <button type="button" className="text-subhead text-accent" onClick={() => pad.current?.clear()}>
                  Clear
                </button>
              </div>
            </div>
          </ListSection>
          <ListSection header="Confirm it's you" footer="Your NEWMUX OS password, checked again before signing.">
            <PlainRowInput type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </ListSection>
          <Button className="w-full" onClick={() => void issue(true)} disabled={busy || !inked || !password}>
            <ShieldCheck className="mr-2 h-5 w-5" /> {busy ? "Issuing…" : "Approve and Issue"}
          </Button>
          <p className="mt-3 text-center text-footnote text-label-2">It gets its number and locks. Any later change makes a new version that needs signing again.</p>
        </div>
      )}
    </Sheet>
  );
}
