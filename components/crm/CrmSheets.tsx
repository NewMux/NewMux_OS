"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useConfirm } from "@/components/ui/Confirm";
import { DeleteRow, MoneyRow, type Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { minorToMajor } from "@/lib/money";
import { DEAL_STAGE, ACTIVITY_KIND } from "@/lib/labels";
import type { ActivityKind, Client, Contact, Currency, Deal, DealStage } from "@/lib/data/types";

export type ContactOption = Option & { clientId: string | null };

// ---------------- Client ----------------

export function ClientSheet({ client, open, onOpenChange }: { client?: Client; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const router = useRouter();
  const confirm = useConfirm();
  const blank = { name: "", shortName: "", industry: "", website: "", email: "", phone: "", billingAddress: "", notes: "" };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      client
        ? {
            name: client.name,
            shortName: client.shortName ?? "",
            industry: client.industry ?? "",
            website: client.website ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            billingAddress: client.billingAddress ?? "",
            notes: client.notes ?? "",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client]);

  const submit = async () => {
    if (client) return !!(await run(`/api/clients/${client.id}`, { method: "PATCH", body: f, success: "Saved" }));
    const res = await run<{ client: Client }>("/api/clients", { body: f, success: "Client added", refresh: false });
    if (res) router.push(`/clients/${res.client.id}`);
    return !!res;
  };

  const remove = async () => {
    if (!client) return;
    if (await confirm({ title: `Delete ${client.name}?`, message: "Only possible while no invoices, payments, expenses or hosting fees refer to it. Contacts and activities are deleted too.", destructive: true, confirmLabel: "Delete Client" })) {
      if (await run(`/api/clients/${client.id}`, { method: "DELETE", success: "Client deleted", refresh: false })) {
        onOpenChange(false);
        router.push("/clients");
        router.refresh();
      }
    }
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={client ? "Edit Client" : "New Client"} submitLabel={client ? "Done" : "Add"} canSubmit={!!f.name.trim()} onSubmit={submit}>
      <ListSection>
        <PlainRowInput placeholder="Company name" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!client} />
        <PlainRowInput placeholder="Short name for lists (optional)" value={f.shortName} onChange={(e) => set("shortName", e.target.value)} />
        <PlainRowInput placeholder="Industry" value={f.industry} onChange={(e) => set("industry", e.target.value)} />
      </ListSection>
      <ListSection>
        <PlainRowInput placeholder="Phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        <PlainRowInput placeholder="Email" type="email" inputMode="email" autoCapitalize="none" value={f.email} onChange={(e) => set("email", e.target.value)} />
        <PlainRowInput placeholder="Website" inputMode="url" autoCapitalize="none" value={f.website} onChange={(e) => set("website", e.target.value)} />
      </ListSection>
      <ListSection>
        <div className="px-4 py-2.5 hairline-b">
          <Textarea placeholder="Billing address" rows={2} value={f.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} />
        </div>
        <div className="px-4 py-2.5">
          <Textarea placeholder="Notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {client && <DeleteRow label="Delete Client" onClick={remove} />}
    </FormSheet>
  );
}

// ---------------- Contact ----------------

export function ContactSheet({
  contact,
  open,
  onOpenChange,
  clients,
  defaultClientId,
}: {
  contact?: Contact;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: Option[];
  defaultClientId?: string;
}) {
  const { run } = useMutation();
  const router = useRouter();
  const confirm = useConfirm();
  const blank = { fullName: "", title: "", clientId: defaultClientId ?? "", phone: "", whatsapp: "", email: "", isPrimary: false, notes: "" };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      contact
        ? {
            fullName: contact.fullName,
            title: contact.title ?? "",
            clientId: contact.clientId ?? "",
            phone: contact.phone ?? "",
            whatsapp: contact.whatsapp ?? "",
            email: contact.email ?? "",
            isPrimary: contact.isPrimary,
            notes: contact.notes ?? "",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact]);

  const submit = async () =>
    !!(contact
      ? await run(`/api/contacts/${contact.id}`, { method: "PATCH", body: f, success: "Saved" })
      : await run("/api/contacts", { body: f, success: "Contact added" }));

  const remove = async () => {
    if (!contact) return;
    if (await confirm({ title: `Delete ${contact.fullName}?`, destructive: true, confirmLabel: "Delete Contact" })) {
      if (await run(`/api/contacts/${contact.id}`, { method: "DELETE", success: "Contact deleted", refresh: false })) {
        onOpenChange(false);
        router.push("/contacts");
        router.refresh();
      }
    }
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={contact ? "Edit Contact" : "New Contact"} submitLabel={contact ? "Done" : "Add"} canSubmit={!!f.fullName.trim()} onSubmit={submit}>
      <ListSection>
        <PlainRowInput placeholder="Full name" autoComplete="off" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} autoFocus={!contact} />
        <PlainRowInput placeholder="Job title" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <FieldRow label="Company">
          <Select value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        {f.clientId && (
          <FieldRow label="Primary contact">
            <Toggle checked={f.isPrimary} onChange={(v) => set("isPrimary", v)} label="Primary contact" />
          </FieldRow>
        )}
      </ListSection>
      <ListSection>
        <PlainRowInput placeholder="Phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        <PlainRowInput placeholder="WhatsApp (if different)" type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        <PlainRowInput placeholder="Email" type="email" inputMode="email" autoCapitalize="none" value={f.email} onChange={(e) => set("email", e.target.value)} />
      </ListSection>
      <ListSection>
        <div className="px-4 py-2.5">
          <Textarea placeholder="Notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {contact && <DeleteRow label="Delete Contact" onClick={remove} />}
    </FormSheet>
  );
}

// ---------------- Deal ----------------

export function DealSheet({
  deal,
  open,
  onOpenChange,
  clients,
  contacts,
  users,
  defaults,
}: {
  deal?: Deal;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: Option[];
  contacts: ContactOption[];
  users: Option[];
  defaults?: { clientId?: string; stage?: DealStage };
}) {
  const { run } = useMutation();
  const router = useRouter();
  const blank = {
    title: "",
    clientId: defaults?.clientId ?? "",
    contactId: "",
    stage: defaults?.stage ?? ("lead" as DealStage),
    value: "",
    currency: "BHD" as Currency,
    expectedClose: "",
    ownerId: "",
    source: "",
    notes: "",
  };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      deal
        ? {
            title: deal.title,
            clientId: deal.clientId ?? "",
            contactId: deal.contactId ?? "",
            stage: deal.stage,
            value: String(minorToMajor(deal.valueCents, deal.currency)),
            currency: deal.currency,
            expectedClose: deal.expectedClose ?? "",
            ownerId: deal.ownerId ?? "",
            source: deal.source ?? "",
            notes: deal.notes ?? "",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deal]);

  const visibleContacts = f.clientId ? contacts.filter((c) => c.clientId === f.clientId) : contacts;

  const submit = async () => {
    const payload = { ...f, value: Number(f.value) || 0 };
    if (deal) return !!(await run(`/api/deals/${deal.id}`, { method: "PATCH", body: payload, success: "Saved" }));
    const res = await run<{ deal: Deal }>("/api/deals", { body: payload, success: "Deal created", refresh: false });
    if (res) router.push(`/crm/deals/${res.deal.id}`);
    return !!res;
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={deal ? "Edit Deal" : "New Deal"} submitLabel={deal ? "Done" : "Add"} canSubmit={!!f.title.trim()} onSubmit={submit}>
      <ListSection>
        <PlainRowInput placeholder="Deal name (e.g. Website redesign)" value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus={!deal} />
      </ListSection>
      <ListSection>
        <MoneyRow label="Value" amount={f.value} currency={f.currency} onAmount={(v) => set("value", v)} onCurrency={(v) => set("currency", v)} />
        {!deal && (
          <FieldRow label="Stage">
            <Select value={f.stage} onChange={(e) => set("stage", e.target.value as DealStage)}>
              {(["lead", "qualified", "proposal", "negotiation"] as DealStage[]).map((s) => (
                <option key={s} value={s}>
                  {DEAL_STAGE[s].label}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
        <FieldRow label="Expected close">
          <RowInput type="date" value={f.expectedClose} onChange={(e) => set("expectedClose", e.target.value)} />
        </FieldRow>
      </ListSection>
      <ListSection>
        <FieldRow label="Client">
          <Select
            value={f.clientId}
            onChange={(e) => {
              set("clientId", e.target.value);
              if (f.contactId && !contacts.some((c) => c.id === f.contactId && c.clientId === e.target.value)) set("contactId", "");
            }}
          >
            <option value="">New prospect</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Contact">
          <Select value={f.contactId} onChange={(e) => set("contactId", e.target.value)}>
            <option value="">None</option>
            {visibleContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Owner">
          <Select value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
            <option value="">{deal ? "Unassigned" : "Me"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <PlainRowInput placeholder="Source (referral, website, …)" value={f.source} onChange={(e) => set("source", e.target.value)} />
      </ListSection>
      <ListSection>
        <div className="px-4 py-2.5">
          <Textarea placeholder="Notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
    </FormSheet>
  );
}

// ---------------- Activity (log a call/email/note, or schedule a follow-up) ----------------

const LOG_KINDS: ActivityKind[] = ["call", "whatsapp", "email", "meeting", "note"];

export function ActivitySheet({
  open,
  onOpenChange,
  link,
  mode: initialMode = "log",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  link: { clientId?: string | null; contactId?: string | null; dealId?: string | null };
  mode?: "log" | "follow_up";
}) {
  const { run } = useMutation();
  const [mode, setMode] = useState<"log" | "follow_up">(initialMode);
  const [kind, setKind] = useState<ActivityKind>("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setKind("call");
      setSubject("");
      setBody("");
      const d = new Date(Date.now() + 86_400_000);
      d.setHours(9, 0, 0, 0);
      setDueAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  }, [open, initialMode]);

  const submit = async () =>
    !!(await run("/api/activities", {
      body: {
        ...link,
        kind: mode === "follow_up" ? "follow_up" : kind,
        subject,
        body,
        dueAt: mode === "follow_up" ? dueAt : null,
      },
      success: mode === "follow_up" ? "Follow-up scheduled" : "Logged",
    }));

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={mode === "log" ? "Log Activity" : "Follow-up"} submitLabel={mode === "log" ? "Log" : "Add"} canSubmit={!!subject.trim()} onSubmit={submit} size="auto">
      <SegmentedControl
        className="mb-5"
        value={mode}
        onChange={setMode}
        options={[
          { value: "log", label: "Log what happened" },
          { value: "follow_up", label: "Remind me" },
        ]}
      />
      <ListSection>
        {mode === "log" ? (
          <FieldRow label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)}>
              {LOG_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_KIND[k].label}
                </option>
              ))}
            </Select>
          </FieldRow>
        ) : (
          <FieldRow label="When">
            <RowInput type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </FieldRow>
        )}
        <PlainRowInput placeholder={mode === "log" ? "Summary (e.g. Discussed pricing)" : "What to do (e.g. Send revised quote)"} value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
        <div className="px-4 py-2.5">
          <Textarea placeholder="Details" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </ListSection>
    </FormSheet>
  );
}
