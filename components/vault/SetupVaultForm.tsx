"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShieldCheck } from "lucide-react";

export function SetupVaultForm() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/vault/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase, confirmPassphrase }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.formErrors?.[0] ?? body?.error?.fieldErrors?.confirmPassphrase?.[0] ?? "Could not set up vault.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2 text-brand">
        <ShieldCheck className="h-5 w-5" />
        <h2 className="text-sm font-semibold text-foreground">Set up the Secrets Vault</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose a master passphrase. It encrypts every secret stored here with AES-256-GCM and is never stored
        in plaintext — if it&apos;s lost, secrets cannot be recovered.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          type="password"
          placeholder="Master passphrase (min 12 characters)"
          required
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Confirm passphrase"
          required
          value={confirmPassphrase}
          onChange={(e) => setConfirmPassphrase(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Setting up…" : "Initialize vault"}
        </Button>
      </form>
    </Card>
  );
}
