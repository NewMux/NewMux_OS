"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ListSection } from "@/components/ui/List";
import { CheckCircle } from "@/components/ui/Toggle";
import { useConfirm } from "@/components/ui/Confirm";
import { useMutation } from "@/lib/useMutation";
import type { PipelineItem } from "@/lib/data/types";

/** Business-development checklist (registrations, certificates, agreements). */
export function PipelineTracker({ items }: { items: PipelineItem[] }) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await run("/api/pipeline", { body: { name } })) setName("");
  };
  return (
    <ListSection header="Business Development" footer="Registrations, certificates and partner agreements in progress.">
      {items.map((i) => (
        <div key={i.id} className="flex items-center gap-3 pl-4 [&:last-child_.row-sep]:shadow-none">
          <CheckCircle checked={i.stage === "complete"} onChange={() => run(`/api/pipeline/${i.id}/toggle`)} color="bg-ios-green border-ios-green" label={i.name} />
          <span className="row-sep flex min-h-[44px] flex-1 items-center justify-between gap-2 py-2 pr-3 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
            <span>
              <span className={i.stage === "complete" ? "text-label-2 line-through" : ""}>{i.name}</span>
              {i.notes && <span className="block text-subhead text-label-2">{i.notes}</span>}
            </span>
            <button
              type="button"
              aria-label="Delete"
              className="p-2 text-label-3 hover:text-ios-red"
              onClick={async () => (await confirm({ title: `Delete “${i.name}”?`, destructive: true })) && run(`/api/pipeline/${i.id}`, { method: "DELETE" })}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </span>
        </div>
      ))}
      <form onSubmit={add} className="flex items-center gap-3 pl-4">
        <Plus className="h-5 w-5 text-accent" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add Item" className="min-h-[44px] flex-1 bg-transparent pr-4 placeholder:text-accent focus:outline-none" />
      </form>
    </ListSection>
  );
}

const MIGRATION_STEPS = [
  "Export client list from Notion",
  "Import clients and primary contacts",
  "Recreate open deals in the pipeline",
  "Move SOPs into the Wiki",
  "Re-enter open invoices and payments",
  "Move hosting fee schedule",
  "Store credentials in the Vault",
  "Archive the Notion workspace",
];

/** Notion → NEWMUX migration checklist, saved for the whole team. */
export function MigrationChecklist({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  const { run } = useMutation();
  const toggle = async (step: string, on: boolean) => {
    const next = on ? [...checked, step] : checked.filter((s) => s !== step);
    setChecked(next);
    await run("/api/settings/checklist", { body: { checked: next }, refresh: false });
  };
  return (
    <ListSection header={`Notion Migration · ${checked.length}/${MIGRATION_STEPS.length}`}>
      {MIGRATION_STEPS.map((step) => (
        <div key={step} className="flex items-center gap-3 pl-4 [&:last-child_.row-sep]:shadow-none">
          <CheckCircle checked={checked.includes(step)} onChange={(v) => toggle(step, v)} label={step} />
          <span className="row-sep flex min-h-[44px] flex-1 items-center pr-4 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
            <span className={checked.includes(step) ? "text-label-2 line-through" : ""}>{step}</span>
          </span>
        </div>
      ))}
    </ListSection>
  );
}
