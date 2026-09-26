"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Database, KeyRound, LogOut, Moon, PieChart, PiggyBank, Trash2, Users, Receipt, Info } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Avatar } from "@/components/ui/Avatar";
import { FieldRow, ListRow, ListSection, IconTile, PlainRowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FormSheet } from "@/components/ui/FormSheet";
import { useConfirm } from "@/components/ui/Confirm";
import { ProfitSplitRuleSheet, type Scope } from "./ProfitSplitRuleSheet";
import { useMutation } from "@/lib/useMutation";
import { COMPANY_LINKS, forRole } from "@/lib/nav";
import { NavIcon } from "@/components/shell/NavIcon";
import type { DeductionKind, DeductionType, Party, ProfitSplitRule, UserRole } from "@/lib/data/types";

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
  const [editingDeduction, setEditingDeduction] = useState<DeductionType | null>(null);
  const [editingRule, setEditingRule] = useState<Scope | null>(null);

  useEffect(() => setTheme(readTheme()), []);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };

  const companyLinks = forRole(COMPANY_LINKS, user.role as UserRole).filter((l) => l.href !== "/vault");
  const scopeName = (r: ProfitSplitRule) => scopes.find((s) => s.scopeType === r.scopeType && s.scopeId === r.scopeId)?.name ?? "Unknown";
  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "?";
  const unconfigured = scopes.filter((s) => !rules.some((r) => r.scopeType === s.scopeType && r.scopeId === s.scopeId));
  // Invoice-level overrides are edited on the invoice itself.
  const scopedRules = rules.filter((r) => r.scopeType !== "document");
  const invoiceOverrides = rules.length - scopedRules.length;
  const funds = parties.filter((p) => p.kind === "fund");

  return (
    <Page title="Settings">
      <div className="mx-auto max-w-2xl">
        <ListSection>
          <ListRow leading={<Avatar name={user.name || user.email} size={56} />} title={<span className="text-title3 font-semibold">{user.name}</span>} subtitle={`${user.email} · ${user.role === "partner_admin" ? "Partner" : "Team member"}`} />
        </ListSection>

        {companyLinks.length > 0 && (
          <ListSection>
            {companyLinks.map((l) => (
              <ListRow
                key={l.href}
                href={l.href}
                leading={<IconTile icon={({ className }) => <NavIcon icon={l.icon} className={className} />} color={l.color} />}
                title={l.label}
              />
            ))}
          </ListSection>
        )}

        <ListSection header="Security">
          <ListRow
            href="/vault"
            leading={<IconTile icon={({ className }) => <NavIcon icon="vault" className={className} />} color="teal" />}
            title="Credentials Vault"
            subtitle="Server logins, API tokens and database passwords, encrypted (AES-256)"
            multiline
          />
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
              footer={`Each project or venture can have its own split and deductions, applied in order. Invoices follow their project's rule unless changed on the invoice${invoiceOverrides ? ` (${invoiceOverrides} invoice${invoiceOverrides === 1 ? " has" : "s have"} a custom split)` : ""}.`}
            >
              {scopedRules.map((r) => (
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

            <ListSection
              header={
                <span id="parties" className="scroll-mt-20">
                  Payout Parties
                </span>
              }
              action={<button className="text-subhead text-accent" onClick={() => setPartyOpen(true)}>Add</button>}
              footer="Partners receive a share of profit and don't need a login. A fund (such as the Newmux reserve) collects deductions and is spent through expenses."
            >
              {parties.map((p) => (
                <ListRow
                  key={p.id}
                  leading={<IconTile icon={p.kind === "fund" ? PiggyBank : Users} color={p.kind === "fund" ? "purple" : "green"} />}
                  title={p.name}
                  subtitle={p.kind === "fund" ? "Fund" : "Partner"}
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

            <ListSection header="Deduction Types" action={<button className="text-subhead text-accent" onClick={() => setDeductionOpen(true)}>Add</button>} footer="Taken out before profit is split: fixed amounts or a percentage. One that goes to a fund sets money aside rather than counting as a cost.">
              {deductionTypes.map((d) => (
                <ListRow
                  key={d.id}
                  onClick={() => setEditingDeduction(d)}
                  leading={<IconTile icon={Receipt} color={d.fundPartyId ? "purple" : "orange"} />}
                  title={d.name}
                  subtitle={[d.kind === "fixed" ? "Fixed amount" : "Percentage", d.fundPartyId ? `goes to ${parties.find((p) => p.id === d.fundPartyId)?.name ?? "a fund"}` : null].filter(Boolean).join(" · ")}
                  trailing={
                    <button
                      type="button"
                      aria-label={`Remove ${d.name}`}
                      className="p-2 text-label-3 hover:text-ios-red"
                      onClick={async (e) => {
                        e.stopPropagation();
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
          <ListRow leading={<IconTile icon={Database} color="blue" />} title="Database" detail={dbMode} />
          <ListRow leading={<IconTile icon={Moon} color="indigo" />} title="Install on iPhone" subtitle="Safari → Share → Add to Home Screen" multiline />
          <ListRow leading={<IconTile icon={Info} color="gray" />} title="NEWMUX OS" detail="2.0" />
        </ListSection>
      </div>

      <PasswordSheet open={passwordOpen} onOpenChange={setPasswordOpen} />
      <PartySheet open={partyOpen} onOpenChange={setPartyOpen} />
      <DeductionSheet open={deductionOpen} onOpenChange={setDeductionOpen} funds={funds} />
      <DeductionSheet open={!!editingDeduction} onOpenChange={(o) => !o && setEditingDeduction(null)} funds={funds} editing={editingDeduction ?? undefined} />
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

function PartySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"partner" | "fund">("partner");
  useEffect(() => {
    if (open) {
      setName("");
      setKind("partner");
    }
  }, [open]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New Party"
      submitLabel="Add"
      size="auto"
      canSubmit={!!name.trim()}
      onSubmit={async () => !!(await run("/api/finance/parties", { body: { name, kind }, success: "Party added" }))}
    >
      <ListSection>
        <PlainRowInput placeholder={kind === "fund" ? "Name (e.g. Equipment fund)" : "Name (e.g. Referral partner)"} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </ListSection>
      <SegmentedControl
        value={kind}
        onChange={setKind}
        options={[
          { value: "partner", label: "Partner" },
          { value: "fund", label: "Fund" },
        ]}
      />
      <div className="h-6" />
    </FormSheet>
  );
}

function DeductionSheet({ open, onOpenChange, funds, editing }: { open: boolean; onOpenChange: (o: boolean) => void; funds: Party[]; editing?: DeductionType }) {
  const { run } = useMutation();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DeductionKind>("percentage");
  const [fundPartyId, setFundPartyId] = useState("");
  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setKind(editing?.kind ?? "percentage");
      setFundPartyId(editing?.fundPartyId ?? "");
    }
  }, [open, editing]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Deduction" : "New Deduction"}
      submitLabel={editing ? "Save" : "Add"}
      size="auto"
      canSubmit={!!name.trim()}
      onSubmit={async () =>
        !!(editing
          ? await run(`/api/finance/deduction-types/${editing.id}`, { method: "PATCH", body: { name, fundPartyId }, success: "Saved" })
          : await run("/api/finance/deduction-types", { body: { name, kind, fundPartyId }, success: "Deduction added" }))
      }
    >
      <ListSection>
        <PlainRowInput placeholder="Name (e.g. Newmux Reserve)" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} />
      </ListSection>
      {!editing && (
        <>
          <SegmentedControl
            value={kind}
            onChange={setKind}
            options={[
              { value: "percentage", label: "Percentage" },
              { value: "fixed", label: "Fixed amount" },
            ]}
          />
          <div className="h-6" />
        </>
      )}
      {funds.length > 0 && (
        <ListSection footer="When it goes to a fund, the amount is set aside in that fund's balance instead of counting as a cost.">
          <FieldRow label="Goes to">
            <Select value={fundPartyId} onChange={(e) => setFundPartyId(e.target.value)}>
              <option value="">Nowhere (a cost)</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        </ListSection>
      )}
    </FormSheet>
  );
}
