"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Party } from "@/lib/data/types";

export function PartiesPanel({ parties }: { parties: Party[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/finance/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    setName("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout Parties</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-muted-foreground">
        Anyone who can receive a share of profit — a partner, or a one-off referral partner on a specific deal.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {parties.map((p) => (
          <span key={p.id} className="rounded-full bg-accent px-3 py-1 text-sm text-foreground">
            {p.name}
          </span>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input placeholder="New party name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" required />
        <Button type="submit" size="sm" disabled={saving || !name}>
          Add
        </Button>
      </form>
    </Card>
  );
}
