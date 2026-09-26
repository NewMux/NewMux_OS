"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, ExternalLink, Paperclip } from "lucide-react";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/Confirm";
import { DeleteRow, type Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import type { FileCategory, FileListItem } from "@/lib/data/files";

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  contract: "Contract",
  registration: "Registration",
  certificate: "Certificate",
  brand: "Brand identity",
  legal: "Legal",
  finance: "Finance",
  receipt: "Receipt",
  other: "Other",
};

export function formatBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Upload a file, or edit one's details (item 18). */
export function FileSheet({
  file,
  open,
  onOpenChange,
  clients,
  projects,
  ventures,
}: {
  file?: FileListItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: Option[];
  projects: Option[];
  ventures: Option[];
}) {
  const router = useRouter();
  const { run } = useMutation();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const blank = { name: "", category: "other" as FileCategory, issueDate: "", expiryDate: "", remindDaysBefore: "30", notes: "", clientId: "", projectId: "", ventureId: "" };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setF(
      file
        ? {
            name: file.name,
            category: file.category,
            issueDate: file.issueDate ?? "",
            expiryDate: file.expiryDate ?? "",
            remindDaysBefore: String(file.remindDaysBefore),
            notes: file.notes ?? "",
            clientId: file.clientId ?? "",
            projectId: file.projectId ?? "",
            ventureId: file.ventureId ?? "",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  const submit = async () => {
    if (file) return !!(await run(`/api/files/${file.id}`, { method: "PATCH", body: f, success: "Saved" }));
    if (!picked) return false;
    const form = new FormData();
    form.set("file", picked);
    for (const [k, v] of Object.entries(f)) form.set(k, v);
    const res = await fetch("/api/files", { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Couldn't upload the file.");
      return false;
    }
    toast.success("Uploaded");
    router.refresh();
    return true;
  };

  const links: [keyof typeof f & ("clientId" | "projectId" | "ventureId"), string, Option[]][] = [
    ["clientId", "Client", clients],
    ["projectId", "Project", projects],
    ["ventureId", "Venture", ventures],
  ];

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={file ? "File" : "Upload File"} submitLabel={file ? "Save" : "Upload"} canSubmit={!!f.name.trim() && (!!file || !!picked)} onSubmit={submit}>
      {!file && (
        <ListSection footer="PDF, images or documents, up to 15 MB.">
          <input
            ref={input}
            type="file"
            className="hidden"
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setPicked(chosen);
              if (chosen && !f.name) set("name", chosen.name.replace(/\.[^.]+$/, ""));
            }}
          />
          <ListRow
            leading={<Paperclip className="h-5 w-5 text-accent" />}
            title={picked ? picked.name : <span className="text-accent">Choose File…</span>}
            subtitle={picked ? formatBytes(picked.size) : undefined}
            onClick={() => input.current?.click()}
          />
        </ListSection>
      )}
      {file && (
        <ListSection>
          <ListRow leading={<ExternalLink className="h-5 w-5 text-accent" />} title="Open" subtitle={formatBytes(file.sizeBytes)} onClick={() => window.open(`/api/files/${file.id}/content`, "_blank", "noopener")} />
          <ListRow leading={<Download className="h-5 w-5 text-accent" />} title="Download" onClick={() => (window.location.href = `/api/files/${file.id}/content?download=1`)} />
        </ListSection>
      )}
      <ListSection>
        <PlainRowInput placeholder="Name (e.g. Commercial Registration)" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <FieldRow label="Category">
          <Select value={f.category} onChange={(e) => set("category", e.target.value as FileCategory)}>
            {(Object.keys(CATEGORY_LABEL) as FileCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>
      <ListSection footer="Today's Needs Attention reminds you this many days before it expires.">
        <FieldRow label="Issued">
          <RowInput type="date" value={f.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
        </FieldRow>
        <FieldRow label="Expires">
          <RowInput type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
        </FieldRow>
        {f.expiryDate && (
          <FieldRow label="Remind">
            <RowInput inputMode="numeric" value={f.remindDaysBefore} onChange={(e) => set("remindDaysBefore", e.target.value.replace(/\D/g, ""))} className="w-14 tabular" />
            <span className="ml-1 text-label-2">days before</span>
          </FieldRow>
        )}
      </ListSection>
      <ListSection header="Relates to">
        {links.map(([key, label, options]) => (
          <FieldRow key={key} label={label}>
            <Select value={f[key]} onChange={(e) => set(key, e.target.value)}>
              <option value="">None</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        ))}
      </ListSection>
      <ListSection>
        <div className="px-4 py-3">
          <Textarea placeholder="Notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {file && (
        <DeleteRow
          label="Delete File"
          onClick={async () => {
            if (await confirm({ title: `Delete “${file.name}”?`, destructive: true, confirmLabel: "Delete" }))
              if (await run(`/api/files/${file.id}`, { method: "DELETE", success: "Deleted" })) onOpenChange(false);
          }}
        />
      )}
    </FormSheet>
  );
}
