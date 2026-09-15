"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { PhoneCall } from "lucide-react";
import type { OutreachChannel, OutreachOutcome } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";

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
export function QuickOutcomeModal({
  dealId,
  dealName,
}: {
  dealId: string;
  dealName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<OutreachChannel>("call");
  const [notes, setNotes] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [saving, setSaving] = useState<OutreachOutcome | null>(null);

  async function logOutcome(outcome: OutreachOutcome) {
    setSaving(outcome);
    await apiMutate(`/api/deals/${dealId}/outreach`, {
      method: "POST",
      body: JSON.stringify({
        channel,
        outcome,
        notes: notes || undefined,
        nextFollowUpDate: nextFollowUpDate || undefined,
      }),
    });
    setSaving(null);
    setNotes("");
    setNextFollowUpDate("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <PhoneCall className="h-3.5 w-3.5" /> Log outcome
        </Button>
      </DialogTrigger>
      <DialogContent title="Log outcome — {dealName}">
        <div className="mb-3 flex gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setChannel(c.value)}
              className={cn(
                "min-h-[36px] flex-1 rounded-lg border px-2 text-xs font-medium",
                channel === c.value
                  ? "border-primary bg-primary/15 text-brand"
                  : "border-border text-muted-foreground",
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
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-left text-sm font-medium text-foreground hover:border-primary/50 disabled:opacity-50"
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
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Input
            type="date"
            value={nextFollowUpDate}
            onChange={(e) => setNextFollowUpDate(e.target.value)}
            placeholder="Next follow-up date"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
