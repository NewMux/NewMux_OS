"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MinusCircle, Plus } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { FieldRow, ListRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { FormSheet } from "@/components/ui/FormSheet";
import { Sheet, SheetIconButton } from "@/components/ui/Sheet";
import { useMutation } from "@/lib/useMutation";
import { DOC_TYPE } from "@/lib/labels";
import { formatDate } from "@/lib/time";
import type { CompanyDetails } from "@/lib/data/company";
import type { DocumentType, Signatory, TermsTemplate, TermsTemplateClause } from "@/lib/data/types";

type Login = { id: string; name: string; email: string };
type ClauseDraft = { key: number; title: string; body: string; defaultOn: boolean };

const TYPES: DocumentType[] = ["quote", "proposal", "contract", "invoice", "credit_note", "letter"];
let k = 0;

/**
 * Settings → Official Documents (PRD addendum 1.2, sections 2.4, 4 and 6):
 * the company details every footer prints, who signs, and the Terms &
 * Conditions library. Partners only; every change is in the audit log.
 */
export function OfficialDocsSettings({
  details,
  signatories,
  templates,
  standalone,
  logins,
}: {
  details: CompanyDetails;
  signatories: Signatory[];
  templates: TermsTemplate[];
  standalone: TermsTemplateClause[];
  logins: Login[];
}) {
  const [editingDetails, setEditingDetails] = useState(false);
  const [signatory, setSignatory] = useState<Signatory | "new" | null>(null);
  const [template, setTemplate] = useState<TermsTemplate | "new" | null>(null);
  const [editingStandalone, setEditingStandalone] = useState(false);

  return (
    <Page title="Official Documents" back={{ href: "/settings", label: "Settings" }}>
      <div className="mx-auto max-w-2xl">
        <ListSection header="Company details" footer="Printed in the footer of every quotation, invoice, contract and letter. Typed once here, never per document.">
          <ListRow
            title={`${details.tradeName}, ${details.tagline}`}
            subtitle={[`CR No. ${details.crNumber}`, details.country, details.email, `WhatsApp ${details.whatsapp}`, details.website, `IBAN ${details.iban}`].join(" · ")}
            multiline
            onClick={() => setEditingDetails(true)}
            chevron
          />
        </ListSection>

        <ListSection
          header="Signatories"
          action={
            <button className="text-subhead text-accent" onClick={() => setSignatory("new")}>
              Add
            </button>
          }
          footer="Name and position as printed. Only the linked login can sign as that person, with their password. A document keeps the name and position it was signed with, even if they change here."
        >
          {signatories.map((s) => (
            <ListRow
              key={s.id}
              title={s.fullName}
              subtitle={`${s.position} · signs as ${s.userName ?? "?"}${s.defaultFor.length ? ` · default for ${s.defaultFor.map((t) => DOC_TYPE[t].toLowerCase()).join(", ")}` : ""}`}
              trailing={!s.isActive ? <Badge color="gray">Inactive</Badge> : undefined}
              multiline
              onClick={() => setSignatory(s)}
              chevron
            />
          ))}
          {signatories.length === 0 && <ListRow title="No signatories yet" subtitle="Add one before signing documents." />}
        </ListSection>

        <ListSection
          header="Terms & conditions"
          action={
            <button className="text-subhead text-accent" onClick={() => setTemplate("new")}>
              Add
            </button>
          }
          footer="A template per product type. Saving changed text makes a new version: documents already made keep the text they have."
        >
          {templates.map((t) => (
            <ListRow
              key={t.id}
              title={t.name}
              subtitle={`${t.clauses.length} clauses · version ${t.version}`}
              trailing={!t.isActive ? <Badge color="gray">Hidden</Badge> : undefined}
              onClick={() => setTemplate(t)}
              chevron
            />
          ))}
          <ListRow title="Standalone clauses" subtitle={`${standalone.length} clauses for any document or letter`} onClick={() => setEditingStandalone(true)} chevron />
        </ListSection>
      </div>

      <DetailsSheet open={editingDetails} onOpenChange={setEditingDetails} details={details} />
      <SignatorySheet value={signatory} onClose={() => setSignatory(null)} logins={logins} />
      <TemplateSheet value={template} onClose={() => setTemplate(null)} />
      <StandaloneSheet open={editingStandalone} onOpenChange={setEditingStandalone} clauses={standalone} />
    </Page>
  );
}

function DetailsSheet({ open, onOpenChange, details }: { open: boolean; onOpenChange: (o: boolean) => void; details: CompanyDetails }) {
  const { run } = useMutation();
  const [f, setF] = useState(details);
  useEffect(() => {
    if (open) setF(details);
  }, [open, details]);
  const field = (label: string, key: keyof CompanyDetails, placeholder?: string) => (
    <FieldRow label={label}>
      <RowInput value={f[key] ?? ""} placeholder={placeholder} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))} />
    </FieldRow>
  );
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Company Details"
      canSubmit={!!f.tradeName.trim() && !!f.iban.trim()}
      onSubmit={async () => !!(await run("/api/settings/company-details", { method: "PATCH", body: f, success: "Saved" }))}
    >
      <ListSection>
        {field("Name", "tradeName")}
        {field("Tagline", "tagline")}
        {field("CR No.", "crNumber")}
        {field("Country", "country")}
      </ListSection>
      <ListSection footer="The IBAN also fills {iban} in payment terms.">
        {field("Email", "email")}
        {field("WhatsApp", "whatsapp")}
        {field("Website", "website")}
        {field("IBAN", "iban")}
      </ListSection>
    </FormSheet>
  );
}

function SignatorySheet({ value, onClose, logins }: { value: Signatory | "new" | null; onClose: () => void; logins: Login[] }) {
  const { run } = useMutation();
  const isNew = value === "new";
  const existing = value && value !== "new" ? value : null;
  const blank = { fullName: "", position: "", userId: "", isActive: true, defaultFor: [] as DocumentType[] };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (value) setF(existing ? { fullName: existing.fullName, position: existing.position, userId: existing.userId, isActive: existing.isActive, defaultFor: existing.defaultFor } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <FormSheet
      open={!!value}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "Add Signatory" : "Signatory"}
      canSubmit={!!f.fullName.trim() && !!f.position.trim() && !!f.userId}
      onSubmit={async () =>
        !!(await run(isNew ? "/api/signatories" : `/api/signatories/${existing!.id}`, { method: isNew ? "POST" : "PATCH", body: f, success: isNew ? `${f.fullName} added` : "Saved" }))
      }
    >
      <ListSection footer="As printed under the signature, e.g. Co-founder & COO.">
        <PlainRowInput placeholder="Full name" value={f.fullName} onChange={(e) => setF((p) => ({ ...p, fullName: e.target.value }))} />
        <PlainRowInput placeholder="Position" value={f.position} onChange={(e) => setF((p) => ({ ...p, position: e.target.value }))} />
      </ListSection>
      <ListSection footer="The only login allowed to sign as this person. Signing can't be delegated.">
        <FieldRow label="Signs as">
          <Select value={f.userId} onChange={(e) => setF((p) => ({ ...p, userId: e.target.value }))}>
            <option value="">Choose…</option>
            {logins.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.email})
              </option>
            ))}
          </Select>
        </FieldRow>
        <ListRow title="Active" trailing={<Toggle label="Active" checked={f.isActive} onChange={(v) => setF((p) => ({ ...p, isActive: v }))} />} />
      </ListSection>
      <ListSection header="Default signatory for">
        {TYPES.map((t) => (
          <ListRow
            key={t}
            title={DOC_TYPE[t]}
            trailing={
              <Toggle
                label={DOC_TYPE[t]}
                checked={f.defaultFor.includes(t)}
                onChange={(v) => setF((p) => ({ ...p, defaultFor: v ? [...p.defaultFor, t] : p.defaultFor.filter((x) => x !== t) }))}
              />
            }
          />
        ))}
      </ListSection>
    </FormSheet>
  );
}

function ClauseEditor({ clauses, setClauses }: { clauses: ClauseDraft[]; setClauses: React.Dispatch<React.SetStateAction<ClauseDraft[]>> }) {
  const move = (i: number, by: number) =>
    setClauses((cs) => {
      const next = [...cs];
      const [c] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, c!);
      return next;
    });
  return (
    <ListSection header="Clauses" footer="Off-by-default clauses are offered on each document but not ticked. {iban} becomes the company IBAN.">
      {clauses.map((c, i) => (
        <div key={c.key} className="py-2.5 pl-3 pr-4 hairline-b">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Remove clause" onClick={() => setClauses((cs) => cs.filter((x) => x.key !== c.key))}>
              <MinusCircle className="h-5 w-5 fill-ios-red text-white" />
            </button>
            <span className="w-6 text-subhead text-accent tabular">{i + 1}</span>
            <input
              value={c.title}
              onChange={(e) => setClauses((cs) => cs.map((x) => (x.key === c.key ? { ...x, title: e.target.value } : x)))}
              placeholder="Title"
              className="min-w-0 flex-1 bg-transparent font-medium placeholder:text-label-3 focus:outline-none"
            />
            <Toggle label="On by default" checked={c.defaultOn} onChange={(v) => setClauses((cs) => cs.map((x) => (x.key === c.key ? { ...x, defaultOn: v } : x)))} />
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="text-label-2 disabled:opacity-30">
              <ChevronUp className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Move down" disabled={i === clauses.length - 1} onClick={() => move(i, 1)} className="text-label-2 disabled:opacity-30">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
          <Textarea className="mt-1.5" rows={3} value={c.body} onChange={(e) => setClauses((cs) => cs.map((x) => (x.key === c.key ? { ...x, body: e.target.value } : x)))} />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setClauses((cs) => [...cs, { key: ++k, title: "", body: "", defaultOn: true }])}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 text-body text-accent active:bg-fill/20"
      >
        <Plus className="h-5 w-5 rounded-full bg-ios-green p-0.5 text-white" strokeWidth={3} />
        Add Clause
      </button>
    </ListSection>
  );
}

const toDrafts = (cs: { title: string; body: string; defaultOn: boolean }[]) => cs.map((c) => ({ key: ++k, title: c.title, body: c.body, defaultOn: c.defaultOn }));
const fromDrafts = (cs: ClauseDraft[]) => cs.filter((c) => c.body.trim()).map((c) => ({ title: c.title.trim(), body: c.body.trim(), defaultOn: c.defaultOn }));

function TemplateSheet({ value, onClose }: { value: TermsTemplate | "new" | null; onClose: () => void }) {
  const { run } = useMutation();
  const isNew = value === "new";
  const existing = value && value !== "new" ? value : null;
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [clauses, setClauses] = useState<ClauseDraft[]>([]);
  const [versions, setVersions] = useState<{ version: number; savedAt: string; savedByName: string | null; clauses: unknown[] }[] | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  useEffect(() => {
    if (!value) return;
    setName(existing?.name ?? "");
    setActive(existing?.isActive ?? true);
    setClauses(toDrafts(existing?.clauses ?? []));
    setVersions(null);
    if (existing)
      fetch(`/api/terms/templates/${existing.id}`)
        .then((r) => r.json())
        .then((j: { versions?: typeof versions }) => setVersions(j.versions ?? []))
        .catch(() => setVersions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <>
      <FormSheet
        open={!!value}
        onOpenChange={(o) => !o && onClose()}
        title={isNew ? "New Template" : (existing?.name ?? "Template")}
        canSubmit={!!name.trim() && clauses.every((c) => c.body.trim() || !c.title.trim())}
        onSubmit={async () =>
          !!(await run(isNew ? "/api/terms/templates" : `/api/terms/templates/${existing!.id}`, {
            method: isNew ? "POST" : "PATCH",
            body: { name, isActive: active, clauses: fromDrafts(clauses) },
            success: "Saved",
          }))
        }
      >
        <ListSection footer={existing ? `Version ${existing.version}. Saving changes makes version ${existing.version + 1}; documents already made keep their text.` : "The product type, e.g. ERP System."}>
          <PlainRowInput placeholder="Product type" value={name} onChange={(e) => setName(e.target.value)} />
          <ListRow title="Offered on documents" trailing={<Toggle label="Offered on documents" checked={active} onChange={setActive} />} />
        </ListSection>
        <ClauseEditor clauses={clauses} setClauses={setClauses} />
        {existing && versions && versions.length > 1 && (
          <ListSection>
            <ListRow title={<span className="text-accent">Version History…</span>} onClick={() => setShowVersions(true)} />
          </ListSection>
        )}
      </FormSheet>
      <Sheet open={showVersions} onOpenChange={setShowVersions} title="Versions" left={<SheetIconButton label="Close" onClick={() => setShowVersions(false)} />}>
        {versions?.map((v) => (
          <ListSection key={v.version} header={`Version ${v.version} · ${formatDate(v.savedAt)}${v.savedByName ? ` · ${v.savedByName}` : ""}`}>
            {(v.clauses as { title: string; body: string }[]).map((c, i) => (
              <ListRow key={i} title={c.title || `Clause ${i + 1}`} subtitle={c.body} multiline />
            ))}
          </ListSection>
        ))}
      </Sheet>
    </>
  );
}

function StandaloneSheet({ open, onOpenChange, clauses }: { open: boolean; onOpenChange: (o: boolean) => void; clauses: TermsTemplateClause[] }) {
  const { run } = useMutation();
  const [drafts, setDrafts] = useState<ClauseDraft[]>([]);
  useEffect(() => {
    if (open) setDrafts(toDrafts(clauses));
  }, [open, clauses]);
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Standalone Clauses" onSubmit={async () => !!(await run("/api/terms/clauses", { method: "PUT", body: { clauses: fromDrafts(drafts) }, success: "Saved" }))}>
      <ClauseEditor clauses={drafts} setClauses={setDrafts} />
    </FormSheet>
  );
}
