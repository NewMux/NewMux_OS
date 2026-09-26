"use client";

import { useMemo, useState } from "react";
import { FileText, FolderOpen, Image as ImageIcon } from "lucide-react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchField } from "@/components/ui/SearchField";
import { CATEGORY_LABEL, FileSheet, formatBytes } from "@/components/files/FileSheet";
import type { Option } from "@/components/forms/Fields";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { daysUntil, formatDate } from "@/lib/time";
import type { FileCategory, FileListItem } from "@/lib/data/files";

function expiry(f: FileListItem): { text: string; color?: "red" | "orange" } | null {
  if (!f.expiryDate) return null;
  const days = daysUntil(f.expiryDate);
  if (days < 0) return { text: `Expired ${formatDate(f.expiryDate)}`, color: "red" };
  if (days <= f.remindDaysBefore) return { text: `Expires ${formatDate(f.expiryDate)} · ${days} day${days === 1 ? "" : "s"}`, color: "orange" };
  return { text: `Expires ${formatDate(f.expiryDate)}` };
}

/** Company files with expiry reminders (item 18). */
export function FilesScreen({ files, clients, projects, ventures }: { files: FileListItem[]; clients: Option[]; projects: Option[]; ventures: Option[] }) {
  const [editing, setEditing] = useState<FileListItem | "new" | null>(null);
  const [q, setQ] = useState("");
  useNewParam(() => setEditing("new"));

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? files.filter((f) => [f.name, f.notes, f.clientName, f.projectName, f.ventureName, CATEGORY_LABEL[f.category]].some((v) => v?.toLowerCase().includes(term))) : files;
  }, [files, q]);
  const attention = visible.filter((f) => expiry(f)?.color);
  const groups = (Object.keys(CATEGORY_LABEL) as FileCategory[])
    .map((c) => [c, visible.filter((f) => f.category === c && !attention.includes(f))] as const)
    .filter(([, items]) => items.length > 0);

  const row = (f: FileListItem) => {
    const e = expiry(f);
    return (
      <ListRow
        key={f.id}
        onClick={() => setEditing(f)}
        leading={<IconTile icon={f.contentType.startsWith("image/") ? ImageIcon : FileText} color={e?.color ?? "blue"} />}
        title={f.name}
        subtitle={[e?.text ?? (f.issueDate ? `Issued ${formatDate(f.issueDate)}` : null), f.clientName ?? f.projectName ?? f.ventureName, formatBytes(f.sizeBytes)].filter(Boolean).join(" · ")}
        trailing={e?.color ? <Badge color={e.color}>{e.color === "red" ? "Expired" : "Renew soon"}</Badge> : undefined}
      />
    );
  };

  return (
    <Page
      title="Files"
      back={{ href: "/company", label: "Company" }}
      actions={
        <QuickAddMenu extra={[{ label: "Upload file", onSelect: () => setEditing("new") }]} />
      }
      accessory={<SearchField value={q} onChange={setQ} placeholder="Search files" />}
    >
      <div className="mx-auto max-w-3xl">
        {files.length === 0 && <EmptyState icon={FolderOpen} title="No files yet" message="Upload contracts, the Commercial Registration and brand files, with their expiry dates." />}
        {attention.length > 0 && (
          <ListSection header="Expiring" info="Inside their reminder window or already expired. They also appear in Today's Needs Attention.">
            {attention.map(row)}
          </ListSection>
        )}
        {groups.map(([c, items]) => (
          <ListSection key={c} header={CATEGORY_LABEL[c]}>
            {items.map(row)}
          </ListSection>
        ))}
      </div>
      <FileSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        file={editing && editing !== "new" ? editing : undefined}
        clients={clients}
        projects={projects}
        ventures={ventures}
      />
    </Page>
  );
}
