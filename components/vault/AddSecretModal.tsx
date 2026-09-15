"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, X } from "lucide-react";
import type { SecretType } from "@/lib/data/types";

export function AddSecretModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [secretType, setSecretType] = useState<SecretType>("api_token");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, secretType, value }),
    });
    setSaving(false);
    if (res.status === 401) {
      setError("Unlock the vault first.");
      return;
    }
    if (!res.ok) {
      setError("Could not save secret.");
      return;
    }
    setLabel("");
    setValue("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add secret
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-white">Add secret</Dialog.Title>
            <Dialog.Close className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input placeholder="Label" required value={label} onChange={(e) => setLabel(e.target.value)} />
            <select
              value={secretType}
              onChange={(e) => setSecretType(e.target.value as SecretType)}
              className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="api_token">API token</option>
              <option value="db_connection">DB connection</option>
              <option value="deploy_key">Deploy key</option>
              <option value="ssh_login">SSH login</option>
              <option value="other">Other</option>
            </select>
            <Input
              placeholder="Secret value"
              required
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={saving || !label || !value}>
              {saving ? "Encrypting…" : "Save encrypted"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
