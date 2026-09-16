"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Party } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";
import { PartyRowActions } from "./PartyRowActions";

export function PartiesPanel({ parties }: { parties: Party[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiMutate("/api/finance/parties", {
      method: "POST",
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
        Anyone who can receive a share of profit — a partner, or a one-off
        referral partner on a specific deal.
      </p>
      <div className="mb-3 flex flex-col gap-1">
        {parties.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
          >
            <span className="text-foreground">{p.name}</span>
            <PartyRowActions party={p} />
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          placeholder="New party name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
          required
        />
        <Button type="submit" size="sm" disabled={saving || !name}>
          Add
        </Button>
      </form>
    </Card>
  );
}
