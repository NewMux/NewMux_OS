"use client";

import { useEffect, useState } from "react";
import { Award, Building2, Globe, Handshake, Trash2, FolderOpen } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FieldRow, ListRow, ListSection, IconTile, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { FormSheet } from "@/components/ui/FormSheet";
import { useConfirm } from "@/components/ui/Confirm";
import { DeleteRow } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { daysUntil, formatDate, relativeDay } from "@/lib/time";
import type { Certification, CertificationStatus, CompanyProfile } from "@/lib/data/types";

const CERT_COLOR = { active: "green", pending: "orange", expired: "red" } as const;

function renewal(date: string | null) {
  if (!date) return { text: "Not set", badge: null };
  const d = daysUntil(date);
  return {
    text: formatDate(date),
    badge: d < 0 ? <Badge color="red">Expired</Badge> : d <= 30 ? <Badge color="orange">{relativeDay(date)}</Badge> : null,
  };
}

export function CompanyScreen({ profile, files }: { profile: CompanyProfile; files?: { total: number; expiring: number } }) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [cert, setCert] = useState<Certification | null | "new">(null);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const cr = renewal(profile.crRenewalDate);
  const domain = renewal(profile.mainDomainRenewalDate);

  return (
    <Page
      title="Company"
      subtitle={profile.legalName}
      actions={
        <NavButton label="Edit company details" onClick={() => setEditing(true)} className="px-4 text-subhead font-medium">
          Edit
        </NavButton>
      }
    >
      <div className="mx-auto max-w-2xl">
        <ListSection header="Registration">
          <ListRow
            leading={<IconTile icon={Building2} color="blue" />}
            title="Commercial Registration"
            subtitle={cr.badge ? `CR ${profile.crNumber || "—"} · renews ${cr.text}` : `CR ${profile.crNumber || "—"}`}
            detail={cr.badge ? undefined : cr.text}
            trailing={cr.badge}
          />
          <ListRow
            leading={<IconTile icon={Globe} color="teal" />}
            title={profile.mainDomain || "Main domain"}
            subtitle={domain.badge ? `Renews ${domain.text}` : "Domain renewal"}
            detail={domain.badge ? undefined : domain.text}
            trailing={domain.badge}
          />
          {profile.vatNumber && <ListRow title="VAT number" detail={profile.vatNumber} />}
          {profile.email && <ListRow title="Email" detail={profile.email} />}
          {profile.phone && <ListRow title="Phone" detail={profile.phone} />}
          {profile.address && <ListRow title="Address" subtitle={profile.address} multiline />}
        </ListSection>

        {files && (
          <ListSection header="Files" info="Contracts, the CR certificate, brand identity and other company documents, with expiry reminders.">
            <ListRow
              href="/files"
              leading={<IconTile icon={FolderOpen} color="blue" />}
              title="Company files"
              subtitle={files.total ? `${files.total} file${files.total === 1 ? "" : "s"}` : "Upload the CR certificate, contracts and brand files"}
              trailing={files.expiring > 0 ? <Badge color="orange">{files.expiring} expiring</Badge> : undefined}
            />
          </ListSection>
        )}

        <ListSection header="Certifications" action={<button className="text-subhead text-accent" onClick={() => setCert("new")}>Add</button>} footer="Expiry dates within 30 days show up on Today.">
          {profile.certifications.map((c) => (
            <ListRow
              key={c.id}
              onClick={() => setCert(c)}
              leading={<IconTile icon={Award} color={CERT_COLOR[c.status]} />}
              title={c.name}
              subtitle={c.expiryDate ? `Expires ${formatDate(c.expiryDate)}` : "No expiry"}
              trailing={<Badge color={CERT_COLOR[c.status]}>{c.status[0]!.toUpperCase() + c.status.slice(1)}</Badge>}
              chevron
            />
          ))}
        </ListSection>

        <ListSection header="Partnerships" action={<button className="text-subhead text-accent" onClick={() => setPartnerOpen(true)}>Add</button>}>
          {profile.partnerships.map((p) => (
            <ListRow
              key={p.id}
              leading={<IconTile icon={Handshake} color="purple" />}
              title={p.name}
              subtitle={p.description ?? undefined}
              trailing={
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  className="p-2 text-label-3 hover:text-ios-red"
                  onClick={async () => (await confirm({ title: `Remove ${p.name}?`, destructive: true, confirmLabel: "Remove" })) && run(`/api/company/partnerships/${p.id}`, { method: "DELETE", success: "Removed" })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              }
            />
          ))}
        </ListSection>
        <p className="px-4 text-center text-footnote text-label-2">Company logins and API keys live in the Vault.</p>
      </div>

      <ProfileSheet open={editing} onOpenChange={setEditing} profile={profile} />
      <CertificationSheet cert={cert} onClose={() => setCert(null)} />
      <PartnershipSheet open={partnerOpen} onOpenChange={setPartnerOpen} />
    </Page>
  );
}

function ProfileSheet({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (o: boolean) => void; profile: CompanyProfile }) {
  const { run } = useMutation();
  const pick = () => ({
    legalName: profile.legalName,
    crNumber: profile.crNumber,
    crRenewalDate: profile.crRenewalDate ?? "",
    mainDomain: profile.mainDomain,
    mainDomainRenewalDate: profile.mainDomainRenewalDate ?? "",
    vatNumber: profile.vatNumber ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
  });
  const [f, setF] = useState(pick);
  useEffect(() => {
    if (open) setF(pick());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (k: keyof ReturnType<typeof pick>, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Company Details" submitLabel="Done" canSubmit={!!f.legalName.trim()} onSubmit={async () => !!(await run("/api/company", { method: "PATCH", body: f, success: "Saved" }))}>
      <ListSection>
        <PlainRowInput placeholder="Legal name" value={f.legalName} onChange={(e) => set("legalName", e.target.value)} />
        <PlainRowInput placeholder="CR number" value={f.crNumber} onChange={(e) => set("crNumber", e.target.value)} />
        <FieldRow label="CR renewal">
          <RowInput type="date" value={f.crRenewalDate} onChange={(e) => set("crRenewalDate", e.target.value)} />
        </FieldRow>
        <PlainRowInput placeholder="VAT number" value={f.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} />
      </ListSection>
      <ListSection>
        <PlainRowInput placeholder="Main domain" autoCapitalize="none" value={f.mainDomain} onChange={(e) => set("mainDomain", e.target.value)} />
        <FieldRow label="Domain renewal">
          <RowInput type="date" value={f.mainDomainRenewalDate} onChange={(e) => set("mainDomainRenewalDate", e.target.value)} />
        </FieldRow>
      </ListSection>
      <ListSection>
        <PlainRowInput placeholder="Email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        <PlainRowInput placeholder="Phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        <PlainRowInput placeholder="Address" value={f.address} onChange={(e) => set("address", e.target.value)} />
      </ListSection>
    </FormSheet>
  );
}

function CertificationSheet({ cert, onClose }: { cert: Certification | null | "new"; onClose: () => void }) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const editing = cert && cert !== "new" ? cert : null;
  const [name, setName] = useState("");
  const [status, setStatus] = useState<CertificationStatus>("active");
  const [expiryDate, setExpiryDate] = useState("");
  useEffect(() => {
    if (!cert) return;
    setName(editing?.name ?? "");
    setStatus(editing?.status ?? "active");
    setExpiryDate(editing?.expiryDate ?? "");
  }, [cert, editing]);
  const body = { name, status, expiryDate };
  return (
    <FormSheet
      open={!!cert}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Certification" : "New Certification"}
      submitLabel={editing ? "Done" : "Add"}
      size="auto"
      canSubmit={!!name.trim()}
      onSubmit={async () =>
        !!(editing
          ? await run(`/api/company/certifications/${editing.id}`, { method: "PATCH", body, success: "Saved" })
          : await run("/api/company/certifications", { body, success: "Added" }))
      }
    >
      <ListSection>
        <PlainRowInput placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} />
        <FieldRow label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as CertificationStatus)}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
          </Select>
        </FieldRow>
        <FieldRow label="Expires">
          <RowInput type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </FieldRow>
      </ListSection>
      {editing && (
        <DeleteRow
          label="Delete Certification"
          onClick={async () => {
            if (await confirm({ title: `Delete ${editing.name}?`, destructive: true }))
              if (await run(`/api/company/certifications/${editing.id}`, { method: "DELETE", success: "Deleted" })) onClose();
          }}
        />
      )}
    </FormSheet>
  );
}

function PartnershipSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
    }
  }, [open]);
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="New Partnership" submitLabel="Add" size="auto" canSubmit={!!name.trim()} onSubmit={async () => !!(await run("/api/company/partnerships", { body: { name, description }, success: "Added" }))}>
      <ListSection>
        <PlainRowInput placeholder="Partner name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <PlainRowInput placeholder="What it covers" value={description} onChange={(e) => setDescription(e.target.value)} />
      </ListSection>
    </FormSheet>
  );
}
