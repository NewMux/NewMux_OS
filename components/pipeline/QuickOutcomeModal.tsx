"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { PhoneCall, X } from "lucide-react";
import type { OutreachChannel, OutreachOutcome } from "@/lib/data/types";

const CHANNELS: { value: OutreachChannel; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

const OUTCOMES: { value: OutreachOutcome; label: string }[] = [
  { value: "no_answer", label: "No Answer" },
  { value: "gatekeeper_blocked", label: "Gatekeeper Blocked" },
  { value: "not_interested", label: "Not Interested" },
  { value: "info_requested", label: "Info Requested" },
  { value: "meeting_booked", label: "Meeting Booked" },
];

/** PRD Module 1: log a call/email/WhatsApp outcome in under 10 seconds. */
export function QuickOutcomeModal({ dealId, dealName }: { dealId: string; dealName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<OutreachChannel>("call");
  const [notes, setNotes] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [saving, setSaving] = useState<OutreachOutcome | null>(null);

  async function logOutcome(outcome: OutreachOutcome) {
    setSaving(outcome);
    await fetch(`/api/deals/${dealId}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, outcome, notes: notes || undefined, nextFollowUpDate: nextFollowUpDate || undefined }),
    });
    setSaving(null);
    setNotes("");
    setNextFollowUpDate("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          <PhoneCall className="h-3.5 w-3.5" /> Log outcome
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-white">Log outcome — {dealName}</Dialog.Title>
            <Dialog.Close className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="mb-3 flex gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setChannel(c.value)}
                className={cn(
                  "min-h-[36px] flex-1 rounded-lg border px-2 text-xs font-medium",
                  channel === c.value ? "border-emerald-500 bg-emerald-600/15 text-emerald-400" : "border-white/10 text-slate-400",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={saving !== null}
                onClick={() => logOutcome(o.value)}
                className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 text-left text-sm font-medium text-slate-100 hover:border-emerald-500/50 disabled:opacity-50"
              >
                {saving === o.value ? "Saving…" : o.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <Input
              type="date"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              placeholder="Next follow-up date"
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
