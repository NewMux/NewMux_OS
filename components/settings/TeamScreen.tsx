"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FieldRow, ListRow, ListSection, PlainRowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { FormSheet } from "@/components/ui/FormSheet";
import { useMutation } from "@/lib/useMutation";
import { ROLE_LABEL, type User, type UserRole } from "@/lib/data/types";

type Member = Pick<User, "id" | "fullName" | "email" | "role" | "isActive">;

const ROLES: { id: UserRole; description: string }[] = [
  { id: "partner_admin", description: "Everything, including money, Settings and the Vault." },
  { id: "marketing", description: "Everything except money: CRM (without deal values), Marketing, Work, Wiki and Company. No Finance, documents, Settings or Vault secrets." },
  { id: "lead_dev", description: "Projects, tasks, the calendar and the Wiki." },
];

/** Settings → Team (partners only): who can sign in, with which role, and a way back in for someone locked out. */
export function TeamScreen({ meId, team }: { meId: string; team: Member[] }) {
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [resetting, setResetting] = useState<Member | null>(null);
  const active = team.filter((m) => m.isActive);
  const inactive = team.filter((m) => !m.isActive);
  const row = (m: Member) => (
    <ListRow
      key={m.id}
      leading={<Avatar name={m.fullName} size={36} />}
      title={m.id === meId ? `${m.fullName} (you)` : m.fullName}
      subtitle={m.email}
      trailing={<Badge color={m.role === "partner_admin" ? "blue" : m.role === "marketing" ? "pink" : "gray"}>{ROLE_LABEL[m.role]}</Badge>}
      onClick={() => setEditing(m)}
      chevron
    />
  );
  return (
    <Page
      title="Team"
      back={{ href: "/settings", label: "Settings" }}
      actions={
        <NavButton label="Add person" onClick={() => setEditing("new")}>
          <UserPlus className="h-5 w-5" />
        </NavButton>
      }
    >
      <div className="mx-auto max-w-2xl">
        <ListSection footer="Tap someone to change their role, turn their account off, or set a new password when they can't sign in. Changes reach their session within 5 minutes and are recorded in the audit log.">
          {active.map(row)}
        </ListSection>
        {inactive.length > 0 && <ListSection header="Turned off">{inactive.map(row)}</ListSection>}
        <ListSection header="Roles">
          {ROLES.map((r) => (
            <ListRow key={r.id} title={ROLE_LABEL[r.id]} subtitle={r.description} multiline />
          ))}
        </ListSection>
      </div>
      <MemberSheet member={editing} meId={meId} onClose={() => setEditing(null)} onResetPassword={(m) => setResetting(m)} />
      <ResetPasswordSheet member={resetting} onClose={() => setResetting(null)} />
    </Page>
  );
}

/** Add someone (name, email, role, first password), or change an existing person. */
function MemberSheet({ member, meId, onClose, onResetPassword }: { member: Member | "new" | null; meId: string; onClose: () => void; onResetPassword: (m: Member) => void }) {
  const { run } = useMutation();
  const isNew = member === "new";
  const existing = member && member !== "new" ? member : null;
  const self = existing?.id === meId;
  const [f, setF] = useState({ fullName: "", email: "", role: "marketing" as UserRole, isActive: true, password: "", again: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    if (member) setF(existing ? { fullName: existing.fullName, email: existing.email, role: existing.role, isActive: existing.isActive, password: "", again: "" } : { fullName: "", email: "", role: "marketing", isActive: true, password: "", again: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  const canSubmit = isNew ? !!f.fullName.trim() && /\S+@\S+\.\S+/.test(f.email) && f.password.length >= 10 && f.password === f.again : !!f.fullName.trim();
  return (
    <FormSheet
      open={!!member}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "Add Person" : (existing?.fullName ?? "Person")}
      submitLabel={isNew ? "Add" : "Save"}
      canSubmit={canSubmit}
      onSubmit={async () =>
        isNew
          ? !!(await run("/api/users", { body: { fullName: f.fullName, email: f.email, role: f.role, password: f.password }, success: `${f.fullName} added` }))
          : !!(await run(`/api/users/${existing!.id}`, { method: "PATCH", body: self ? { fullName: f.fullName } : { fullName: f.fullName, role: f.role, isActive: f.isActive }, success: "Saved" }))
      }
    >
      <ListSection>
        <PlainRowInput placeholder="Full name" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} autoFocus={isNew} />
        {isNew ? (
          <PlainRowInput type="email" inputMode="email" autoComplete="off" placeholder="Email (their sign-in)" value={f.email} onChange={(e) => set("email", e.target.value)} />
        ) : (
          <ListRow title="Email" detail={existing?.email} />
        )}
      </ListSection>
      <ListSection footer={self ? "You can't change your own role or turn off your own account." : ROLES.find((r) => r.id === f.role)?.description}>
        <FieldRow label="Role">
          <Select value={f.role} disabled={self} onChange={(e) => set("role", e.target.value as UserRole)}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {ROLE_LABEL[r.id]}
              </option>
            ))}
          </Select>
        </FieldRow>
        {!isNew && !self && <ListRow title="Can sign in" trailing={<Toggle label="Can sign in" checked={f.isActive} onChange={(v) => set("isActive", v)} />} />}
      </ListSection>
      {isNew ? (
        <ListSection header="First password" footer={f.again && f.password !== f.again ? "Passwords don't match." : "At least 10 characters. Tell them in person; they change it under Settings → Account."}>
          {/* The new person's email is a hidden username, so a password manager files it under them. */}
          <input type="text" autoComplete="username" value={f.email} readOnly hidden />
          <PlainRowInput type="password" autoComplete="new-password" placeholder="Password" value={f.password} onChange={(e) => set("password", e.target.value)} />
          <PlainRowInput type="password" autoComplete="new-password" placeholder="Verify" value={f.again} onChange={(e) => set("again", e.target.value)} />
        </ListSection>
      ) : (
        !self &&
        existing && (
          <ListSection>
            <ListRow
              title={<span className="text-accent">Set a New Password…</span>}
              onClick={() => {
                onClose();
                onResetPassword(existing);
              }}
            />
          </ListSection>
        )
      )}
    </FormSheet>
  );
}

function ResetPasswordSheet({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { run } = useMutation();
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  useEffect(() => {
    setNext("");
    setAgain("");
  }, [member]);
  return (
    <FormSheet
      open={!!member}
      onOpenChange={(o) => !o && onClose()}
      title="Set Password"
      submitLabel="Set"
      size="auto"
      canSubmit={next.length >= 10 && next === again}
      onSubmit={async () =>
        !!member && !!(await run(`/api/users/${member.id}/password`, { body: { newPassword: next }, success: `New password set for ${member.fullName}`, refresh: false }))
      }
    >
      <ListSection header={member ? `New password for ${member.fullName}` : undefined} footer={again && next !== again ? "Passwords don't match." : "Use at least 10 characters."}>
        {/* The account's email is a hidden username, so a password manager saves it against the right person. */}
        <input type="text" autoComplete="username" value={member?.email ?? ""} readOnly hidden />
        <PlainRowInput type="password" autoComplete="new-password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} autoFocus />
        <PlainRowInput type="password" autoComplete="new-password" placeholder="Verify" value={again} onChange={(e) => setAgain(e.target.value)} />
      </ListSection>
    </FormSheet>
  );
}
