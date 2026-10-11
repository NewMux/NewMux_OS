"use client";

import { useEffect, useState } from "react";
import { Gauge, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { FieldRow, ListSection } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { HAMAN_EFFORTS, HAMAN_MODELS, type HamanSettings } from "@/lib/haman/models";

/** Settings → Haman (partners): which Claude model he runs on and how hard he thinks. Applies to everyone. */
export function HamanSection() {
  const [settings, setSettings] = useState<HamanSettings | null>(null);

  useEffect(() => {
    fetch("/api/haman/settings")
      .then((r) => r.json())
      .then((d: { settings?: HamanSettings }) => d.settings && setSettings(d.settings))
      .catch(() => {});
  }, []);

  const change = async (patch: Partial<HamanSettings>) => {
    const res = await fetch("/api/haman/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const json = (await res.json().catch(() => ({}))) as { settings?: HamanSettings; error?: string };
    if (res.ok && json.settings) {
      setSettings(json.settings);
      toast.success("Saved");
    } else toast.error(json.error ?? "Couldn't save it.");
  };

  if (!settings) return null;
  const model = HAMAN_MODELS.find((m) => m.id === settings.model);
  const effort = HAMAN_EFFORTS.find((e) => e.id === settings.effort);
  return (
    <ListSection
      header="Haman"
      footer={`${model ? `${model.description} ${model.price} per million tokens in / out.` : `Set by HAMAN_MODEL (${settings.model}).`} ${effort?.description ?? ""} For everyone; you can also switch from the model name at the top of the chat.`}
    >
      <FieldRow label={<span className="flex items-center gap-3"><Sparkles className="h-[18px] w-[18px] text-accent" /> Model</span>}>
        <Select value={model ? settings.model : ""} onChange={(e) => void change({ model: e.target.value })} aria-label="Haman's model">
          {!model && <option value="">{settings.model}</option>}
          {HAMAN_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.price})
            </option>
          ))}
        </Select>
      </FieldRow>
      <FieldRow label={<span className="flex items-center gap-3"><Gauge className="h-[18px] w-[18px] text-accent" /> Depth</span>}>
        <Select value={settings.effort} onChange={(e) => void change({ effort: e.target.value as HamanSettings["effort"] })} aria-label="How hard Haman thinks">
          {HAMAN_EFFORTS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </Select>
      </FieldRow>
    </ListSection>
  );
}
