"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Database, Eye, EyeOff, KeyRound, Lock, LockOpen, Plus, ShieldCheck, Terminal, Trash2, Key } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { ListSection, IconTile, FieldRow, PlainRowInput } from "@/components/ui/List";
import { SearchField } from "@/components/ui/SearchField";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormSheet } from "@/components/ui/FormSheet";
import { Select } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/Confirm";
import { ClientProjectRows, type Option, type ProjectOption } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import type { SecretSummary } from "@/lib/data/vault";
import type { SecretType } from "@/lib/data/types";
import type { SysColor } from "@/lib/colors";

const TYPE: Record<SecretType, { label: string; icon: React.ComponentType<{ className?: string }>; color: SysColor }> = {
  api_token: { label: "API token", icon: Key, color: "blue" },
  db_connection: { label: "Database", icon: Database, color: "green" },
  deploy_key: { label: "Deploy key", icon: KeyRound, color: "orange" },
  ssh_login: { label: "SSH login", icon: Terminal, color: "gray" },
  other: { label: "Other", icon: Lock, color: "purple" },
};

/** Passwords-app style vault: lock screen → searchable, grouped credentials. */
export function VaultScreen({
  state,
  admin,
  secrets,
  projects,
  clients,
}: {
  state: "setup" | "locked" | "unlocked";
  admin: boolean;
  secrets: SecretSummary[];
  projects: ProjectOption[];
  clients: Option[];
}) {
  const router = useRouter();
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, SecretSummary[]>();
    for (const s of secrets) {
      if (term && ![s.label, s.projectName, s.clientName].some((v) => v?.toLowerCase().includes(term))) continue;
      const key = s.projectName ?? s.clientName ?? "General";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [secrets, q]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run("/api/vault/unlock", { body: { passphrase }, success: "Vault unlocked for 15 minutes" })) setPassphrase("");
  };

  const setup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run("/api/vault/setup", { body: { passphrase, confirmPassphrase }, success: "Vault ready" })) {
      setPassphrase("");
      setConfirmPassphrase("");
    }
  };

  const reveal = async (s: SecretSummary) => {
    if (revealed[s.id]) {
      setRevealed(({ [s.id]: _, ...rest }) => rest);
      return;
    }
    const res = await fetch(`/api/vault/${s.id}/reveal`, { method: "POST" });
    if (!res.ok) {
      toast.error(res.status === 401 ? "The vault locked itself. Unlock it again." : "Couldn't reveal this secret.");
      if (res.status === 401) router.refresh();
      return;
    }
    const { value } = (await res.json()) as { value: string };
    setRevealed((r) => ({ ...r, [s.id]: value }));
    // Hide again automatically after 30 seconds.
    setTimeout(() => setRevealed(({ [s.id]: _, ...rest }) => rest), 30_000);
  };

  const copy = async (s: SecretSummary) => {
    let value = revealed[s.id];
    if (!value) {
      const res = await fetch(`/api/vault/${s.id}/reveal`, { method: "POST" });
      if (!res.ok) return void toast.error("Unlock the vault to copy.");
      value = ((await res.json()) as { value: string }).value;
    }
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  };

  const remove = async (s: SecretSummary) => {
    if (await confirm({ title: `Delete “${s.label}”?`, message: "The encrypted value is permanently removed.", destructive: true })) await run(`/api/vault/${s.id}`, { method: "DELETE", success: "Deleted" });
  };

  if (state === "setup") {
    return (
      <Page title="Vault">
        <div className="mx-auto max-w-md">
          {admin ? (
            <form onSubmit={setup}>
              <div className="mb-6 flex flex-col items-center text-center">
                <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-[22px] bg-gradient-to-b from-ios-teal to-ios-blue text-white shadow-float">
                  <ShieldCheck className="h-10 w-10" />
                </span>
                <h2 className="text-title2">Set Up the Vault</h2>
                <p className="mt-1 text-subhead text-label-2">
                  Choose a master passphrase. It encrypts every credential with AES-256-GCM and is never stored — if it&apos;s lost, the secrets can&apos;t be recovered.
                </p>
              </div>
              <ListSection>
                <PlainRowInput type="password" placeholder="Master passphrase (12+ characters)" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="new-password" />
                <PlainRowInput type="password" placeholder="Confirm passphrase" value={confirmPassphrase} onChange={(e) => setConfirmPassphrase(e.target.value)} autoComplete="new-password" />
              </ListSection>
              <Button type="submit" size="lg" disabled={pending || passphrase.length < 12}>
                Create Vault
              </Button>
            </form>
          ) : (
            <EmptyState icon={Lock} title="Vault not set up" message="Ask a partner to set up the vault." />
          )}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Vault"
      subtitle={admin ? undefined : "Values stay masked for your role — ask a partner if you need one."}
      actions={
        state === "unlocked" ? (
          <>
            <NavButton label="Lock vault" onClick={() => run("/api/vault/lock", { success: "Locked" })}>
              <Lock className="h-[18px] w-[18px]" />
            </NavButton>
            <NavButton label="Add credential" onClick={() => setAdding(true)}>
              <Plus className="h-5 w-5" />
            </NavButton>
          </>
        ) : undefined
      }
      accessory={secrets.length > 0 ? <SearchField value={q} onChange={setQ} placeholder="Search credentials" /> : undefined}
    >
      <div className="mx-auto max-w-2xl">
        {admin && state === "locked" && (
          <form onSubmit={unlock} className="mb-7 flex flex-col items-center rounded-[20px] bg-bg-elevated px-5 py-7 text-center shadow-widget dark:shadow-none">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-fill/[0.14]">
              <Lock className="h-7 w-7 text-label-2" />
            </span>
            <h2 className="text-headline">Vault Locked</h2>
            <p className="mb-4 mt-1 text-subhead text-label-2">Enter the master passphrase to reveal and add credentials. It stays unlocked for 15 minutes.</p>
            <div className="flex w-full max-w-sm gap-2">
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Master passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="h-11 flex-1 rounded-xl bg-fill/[0.12] px-3.5 placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <Button type="submit" disabled={pending || !passphrase}>
                <LockOpen className="h-4 w-4" />
                Unlock
              </Button>
            </div>
          </form>
        )}

        {secrets.length === 0 && <EmptyState icon={KeyRound} title="No credentials yet" message={admin ? "Unlock the vault and add API keys, database URLs and SSH logins." : undefined} />}

        {groups.map(([group, items]) => (
          <ListSection key={group} header={group}>
            {items.map((s) => {
              const t = TYPE[s.secretType];
              const value = revealed[s.id];
              return (
                <div key={s.id} className="flex items-center gap-3 pl-4 [&:last-child_.row-sep]:shadow-none">
                  <IconTile icon={t.icon} color={t.color} />
                  <div className="row-sep flex min-h-[56px] min-w-0 flex-1 items-center gap-2 py-2 pr-2 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body">{s.label}</div>
                      <div className="truncate font-mono text-footnote text-label-2">{value ?? s.maskedPreview}</div>
                    </div>
                    {admin && state === "unlocked" && (
                      <>
                        <button type="button" aria-label={value ? "Hide" : "Reveal"} onClick={() => reveal(s)} className="flex h-9 w-9 items-center justify-center rounded-full text-accent hover:bg-fill/10">
                          {value ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                        <button type="button" aria-label="Copy" onClick={() => copy(s)} className="flex h-9 w-9 items-center justify-center rounded-full text-accent hover:bg-fill/10">
                          <Copy className="h-[18px] w-[18px]" />
                        </button>
                        <button type="button" aria-label="Delete" onClick={() => remove(s)} className="flex h-9 w-9 items-center justify-center rounded-full text-label-3 hover:text-ios-red">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </ListSection>
        ))}
        <p className="px-4 text-center text-footnote text-label-2">Every reveal is logged. Values are encrypted with AES-256-GCM and never leave the server unless you reveal them.</p>
      </div>
      <AddSecretSheet open={adding} onOpenChange={setAdding} projects={projects} clients={clients} />
    </Page>
  );
}

function AddSecretSheet({ open, onOpenChange, projects, clients }: { open: boolean; onOpenChange: (o: boolean) => void; projects: ProjectOption[]; clients: Option[] }) {
  const { run } = useMutation();
  const [label, setLabel] = useState("");
  const [secretType, setSecretType] = useState<SecretType>("api_token");
  const [value, setValue] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setLabel("");
          setValue("");
          setClientId("");
          setProjectId("");
        }
      }}
      title="New Credential"
      submitLabel="Save"
      canSubmit={!!label.trim() && !!value}
      onSubmit={async () => !!(await run("/api/vault", { body: { label, secretType, value, clientId, projectId }, success: "Encrypted and saved" }))}
    >
      <ListSection>
        <PlainRowInput placeholder="Label (e.g. Voya production DB)" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        <FieldRow label="Type">
          <Select value={secretType} onChange={(e) => setSecretType(e.target.value as SecretType)}>
            {Object.entries(TYPE).map(([k, t]) => (
              <option key={k} value={k}>
                {t.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <PlainRowInput type="password" placeholder="Secret value" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" />
      </ListSection>
      <ListSection header="Belongs to">
        <ClientProjectRows clients={clients} projects={projects} clientId={clientId} projectId={projectId} onClient={setClientId} onProject={setProjectId} />
      </ListSection>
    </FormSheet>
  );
}
