"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus } from "lucide-react";
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add secret
        </Button>
      </DialogTrigger>
      <DialogContent title="Add secret">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            placeholder="Label"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <select
            value={secretType}
            onChange={(e) => setSecretType(e.target.value as SecretType)}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
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
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={saving || !label || !value}>
            {saving ? "Encrypting…" : "Save encrypted"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
