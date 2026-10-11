"use client";

import { useEffect, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Avatar } from "@/components/ui/Avatar";
import { ListRow, ListSection, PlainRowInput } from "@/components/ui/List";
import { FormSheet } from "@/components/ui/FormSheet";
import { useMutation } from "@/lib/useMutation";
import type { User } from "@/lib/data/types";

type Member = Pick<User, "id" | "fullName" | "email" | "role" | "isActive">;

/** Settings → Team (partners only): everyone with a login, and a way back in for someone locked out. */
export function TeamScreen({ meId, team }: { meId: string; team: Member[] }) {
  const [resetting, setResetting] = useState<Member | null>(null);
  return (
    <Page title="Team" back={{ href: "/settings", label: "Settings" }}>
      <div className="mx-auto max-w-2xl">
        <ListSection footer="Tap someone to set a new password for them, for example when they can't sign in. Tell them in person; they can change it under Settings → Account. Each reset is recorded in the audit log.">
          {team.map((m) =>
            m.id === meId ? (
              <ListRow key={m.id} leading={<Avatar name={m.fullName} size={36} />} title={`${m.fullName} (you)`} subtitle={`${m.email} · ${roleLabel(m)}`} href="/settings" />
            ) : (
              <ListRow key={m.id} leading={<Avatar name={m.fullName} size={36} />} title={m.fullName} subtitle={`${m.email} · ${roleLabel(m)}`} onClick={() => setResetting(m)} chevron />
            ),
          )}
        </ListSection>
      </div>
      <ResetPasswordSheet member={resetting} onClose={() => setResetting(null)} />
    </Page>
  );
}

function roleLabel(m: Member) {
  const role = m.role === "partner_admin" ? "Partner" : "Team member";
  return m.isActive ? role : `${role} · Inactive`;
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
