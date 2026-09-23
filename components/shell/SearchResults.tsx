import Link from "next/link";
import { Building2, CheckCircle2, Contact, FileText, FolderKanban, Handshake, BookOpen } from "lucide-react";
import type { SearchResult } from "@/lib/data/search";
import { IconTile } from "@/components/ui/List";
import type { SysColor } from "@/lib/colors";

export const RESULT_META: Record<SearchResult["kind"], { label: string; icon: React.ComponentType<{ className?: string }>; color: SysColor }> = {
  client: { label: "Clients", icon: Building2, color: "indigo" },
  contact: { label: "Contacts", icon: Contact, color: "gray" },
  deal: { label: "Deals", icon: Handshake, color: "purple" },
  project: { label: "Projects", icon: FolderKanban, color: "orange" },
  task: { label: "Tasks", icon: CheckCircle2, color: "blue" },
  document: { label: "Invoices & Quotes", icon: FileText, color: "green" },
  page: { label: "Wiki", icon: BookOpen, color: "yellow" },
};

export function groupResults(results: SearchResult[]) {
  const groups = new Map<SearchResult["kind"], SearchResult[]>();
  for (const r of results) groups.set(r.kind, [...(groups.get(r.kind) ?? []), r]);
  return [...groups.entries()];
}

export function ResultRow({ result, onNavigate }: { result: SearchResult; onNavigate?: () => void }) {
  const meta = RESULT_META[result.kind];
  return (
    <Link
      href={result.href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-2 transition-colors active:bg-fill/20 md:hover:bg-fill/[0.06] [&:last-child>span]:shadow-none"
    >
      <IconTile icon={meta.icon} color={meta.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body">{result.title}</span>
        {result.subtitle && <span className="block truncate text-subhead text-label-2">{result.subtitle}</span>}
      </span>
    </Link>
  );
}
