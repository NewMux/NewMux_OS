"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Lock } from "lucide-react";

export function UnlockModal() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/vault/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Incorrect passphrase.");
      return;
    }
    setPassphrase("");
    router.refresh();
  }

  return (
    <Card className="mb-4 border-warning/30 bg-warning/5">
      <div className="mb-2 flex items-center gap-2 text-tone-warning-fg">
        <Lock className="h-4 w-4" />
        <p className="text-sm font-medium">Vault is locked</p>
      </div>
      <form onSubmit={handleUnlock} className="flex flex-wrap items-center gap-2">
        <Input
          type="password"
          placeholder="Master passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="max-w-xs"
          required
        />
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Unlocking…" : "Unlock (15 min)"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}
