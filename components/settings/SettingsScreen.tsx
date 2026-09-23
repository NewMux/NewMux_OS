"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Database, KeyRound, LogOut, Moon, PieChart, Trash2, Users, Receipt, BookOpen, Info } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Avatar } from "@/components/ui/Avatar";
import { ListRow, ListSection, IconTile, PlainRowInput } from "@/components/ui/List";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FormSheet } from "@/components/ui/FormSheet";
import { useConfirm } from "@/components/ui/Confirm";
import { ProfitSplitRuleSheet, type Scope } from "./ProfitSplitRuleSheet";
import { useMutation } from "@/lib/useMutation";
import type { DeductionKind, DeductionType, Party, ProfitSplitRule } from "@/lib/data/types";

type Theme = "system" | "light" | "dark";

function readTheme(): Theme {
  const m = document.cookie.match(/(?:^|; )theme=(light|dark|system)/);
  return (m?.[1] as Theme) ?? "system";
}

export function SettingsScreen({
  user,
  admin,
  parties,
  deductionTypes,
  rules,
  scopes,
  dbMode,
}: {
  user: { name: string; email: string; role: string };
  admin: boolean;
  parties: Party[];
  deductionTypes: DeductionType[];
  rules: ProfitSplitRule[];
  scopes: Scope[];
  dbMode: string;
}) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const [theme, setTheme] = useState<Theme>("system");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [deductionOpen, setDeductionOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Scope | null>(null);

  useEffect(() => setTheme(readTheme()), []);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };

  const scopeName = (r: ProfitSplitRule) => scopes.find((s) => s.scopeType === r.scopeType && s.scopeId === r.scopeId)?.name ?? "Unknown";
  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "?";
  const unconfigured = scopes.filter((s) => !rules.some((r) => r.scopeType === s.scopeType && r.scopeId === s.scopeId));

  return (
    <Page title="Settings">
      <div className="mx-auto max-w-2xl">
        <ListSection>
          <ListRow leading={<Avatar name={user.name || user.email} size={56} />} title={<span className="text-title3 font-semibold">{user.name}</span>} subtitle={`${user.email} · ${user.role === "partner_admin" ? "Partner" : "Team member"}`} />
        </ListSection>

        <ListSection header="Appearance">
          <div className="p-3">
            <SegmentedControl
              value={theme}
              onChange={applyTheme}
              options={[
                { value: "system", label: "Automatic" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
        </ListSection>

        <ListSection header="Account">
          <ListRow leading={<IconTile icon={KeyRound} color="gray" />} title="Change Password" onClick={() => setPasswordOpen(true)} chevron />
          <ListRow leading={<IconTile icon={LogOut} color="red" />} title="Sign Out" destructive onClick={() => signOut({ callbackUrl: "/login" })} />
        </ListSection>

        {admin && (
          <>
            <ListSection
              header={
                <span id="splits" className="scroll-mt-20">
                  Profit-Split Rules
                </span>
              }
              footer="Each project or venture can have its own split and deductions. New invoices inherit their project's rule."
            >
              {rules.map((r) => (
                <ListRow
                  key={r.id}
                  leading={<IconTile icon={PieChart} color="purple" />}
                  title={scopeName(r)}
                  subtitle={r.splits.map((s) => `${partyName(s.partyId)} ${s.percentageBps / 100}%`).join(" · ")}
                  onClick={() => setEditingRule({ scopeType: r.scopeType, scopeId: r.scopeId, name: scopeName(r) })}
                  chevron
                />
              ))}
              {unconfigured.length > 0 && (
                <div className="px-4 py-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const s = unconfigured.find((x) => `${x.scopeType}:${x.scopeId}` === e.target.value);
                      if (s) setEditingRule(s);
                    }}
                    className="w-full cursor-pointer appearance-none bg-transparent py-1.5 text-accent focus:outline-none"
                  >
                    <option value="">＋ Add a rule for…</option>
                    {unconfigured.map((s) => (
                      <option key={`${s.scopeType}:${s.scopeId}`} value={`${s.scopeType}:${s.scopeId}`}>
                        {s.scopeType === "project" ? "Project" : "Venture"}: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </ListSection>

            <ListSection header="Payout Parties" action={<button className="text-subhead text-accent" onClick={() => setPartyOpen(true)}>Add</button>} footer="People or companies that receive a share of profit. They don't need a login.">
              {parties.map((p) => (
                <ListRow
                  key={p.id}
                  leading={<IconTile icon={Users} color="green" />}
                  title={p.name}
                  trailing={
                    <button
                      type="button"
                      aria-label={`Remove ${p.name}`}
                      className="p-2 text-label-3 hover:text-ios-red"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (await confirm({ title: `Remove ${p.name}?`, destructive: true, confirmLabel: "Remove" })) await run(`/api/finance/parties/${p.id}`, { method: "DELETE", success: "Removed" });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              ))}
            </ListSection>

            <ListSection header="Deduction Types" action={<button className="text-subhead text-accent" onClick={() => setDeductionOpen(true)}>Add</button>} footer="Costs taken out before profit is split — fixed amounts or a percentage of the invoice.">
              {deductionTypes.map((d) => (
                <ListRow
                  key={d.id}
                  leading={<IconTile icon={Receipt} color="orange" />}
                  title={d.name}
                  subtitle={d.kind === "fixed" ? "Fixed amount" : "Percentage"}
                  trailing={
                    <button
                      type="button"
                      aria-label={`Remove ${d.name}`}
                      className="p-2 text-label-3 hover:text-ios-red"
                      onClick={async () => {
                        if (await confirm({ title: `Remove “${d.name}”?`, destructive: true, confirmLabel: "Remove" })) await run(`/api/finance/deduction-types/${d.id}`, { method: "DELETE", success: "Removed" });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              ))}
            </ListSection>
          </>
        )}

        <ListSection header="More">
          <ListRow href="/wiki" leading={<IconTile icon={BookOpen} color="yellow" />} title="Wiki Spaces" />
          <ListRow leading={<IconTile icon={Database} color="blue" />} title="Database" detail={dbMode} />
          <ListRow leading={<IconTile icon={Moon} color="indigo" />} title="Install on iPhone" subtitle="Safari → Share → Add to Home Screen" multiline />
          <ListRow leading={<IconTile icon={Info} color="gray" />} title="NEWMUX OS" detail="2.0" />
        </ListSection>
      </div>

      <PasswordSheet open={passwordOpen} onOpenChange={setPasswordOpen} />
      <NameSheet
        open={partyOpen}
        onOpenChange={setPartyOpen}
        title="New Party"
        placeholder="Name (e.g. Referral partner)"
        onSave={async (name) => !!(await run("/api/finance/parties", { body: { name }, success: "Party added" }))}
      />
      <DeductionSheet open={deductionOpen} onOpenChange={setDeductionOpen} />
      {editingRule && (
        <ProfitSplitRuleSheet
          open={!!editingRule}
          onOpenChange={(o) => !o && setEditingRule(null)}
          scope={editingRule}
          rule={rules.find((r) => r.scopeType === editingRule.scopeType && r.scopeId === editingRule.scopeId)}
          parties={parties}
          deductionTypes={deductionTypes}
        />
      )}
    </Page>
  );
}

function PasswordSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setAgain("");
    }
  }, [open]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Change Password"
      submitLabel="Change"
      size="auto"
      canSubmit={!!current && next.length >= 10 && next === again}
      onSubmit={async () => !!(await run("/api/me/password", { body: { currentPassword: current, newPassword: next }, success: "Password changed", refresh: false }))}
    >
      <ListSection footer={next && next.length < 10 ? "Use at least 10 characters." : again && next !== again ? "Passwords don't match." : "Use at least 10 characters."}>
        <PlainRowInput type="password" autoComplete="current-password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PlainRowInput type="password" autoComplete="new-password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} />
        <PlainRowInput type="password" autoComplete="new-password" placeholder="Verify" value={again} onChange={(e) => setAgain(e.target.value)} />
      </ListSection>
    </FormSheet>
  );
}

function NameSheet({ open, onOpenChange, title, placeholder, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; placeholder: string; onSave: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={title} submitLabel="Add" size="auto" canSubmit={!!name.trim()} onSubmit={() => onSave(name)}>
      <ListSection>
        <PlainRowInput placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </ListSection>
    </FormSheet>
  );
}

function DeductionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DeductionKind>("percentage");
  useEffect(() => {
    if (open) {
      setName("");
      setKind("percentage");
    }
  }, [open]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New Deduction"
      submitLabel="Add"
      size="auto"
      canSubmit={!!name.trim()}
      onSubmit={async () => !!(await run("/api/finance/deduction-types", { body: { name, kind }, success: "Deduction added" }))}
    >
      <ListSection>
        <PlainRowInput placeholder="Name (e.g. Payment gateway fee)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </ListSection>
      <SegmentedControl
        value={kind}
        onChange={setKind}
        options={[
          { value: "percentage", label: "Percentage" },
          { value: "fixed", label: "Fixed amount" },
        ]}
      />
      <div className="h-6" />
    </FormSheet>
  );
}
