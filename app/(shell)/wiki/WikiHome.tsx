"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Star, FolderPlus } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { SearchField } from "@/components/ui/SearchField";
import { ListRow, ListSection } from "@/components/ui/List";
import { Menu } from "@/components/ui/Menu";
import { SpaceIcon } from "@/components/wiki/SpaceIcon";
import { NewPageSheet, SpaceSheet } from "@/components/wiki/WikiSheets";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { timeAgo } from "@/lib/time";
import type { KbPageSummary, KbSpace } from "@/lib/data/types";

function PageRow({ p, subtitle }: { p: KbPageSummary; subtitle?: string }) {
  return (
    <ListRow
      href={`/wiki/${p.id}`}
      leading={<span className="flex h-[30px] w-[30px] items-center justify-center text-[22px]">{p.emoji ?? "📄"}</span>}
      title={p.title || "Untitled"}
      subtitle={subtitle ?? p.snippet ?? p.spaceName}
    />
  );
}

export function WikiHome({
  spaces,
  templates,
  favorites,
  recents,
  updated,
  canDelete,
}: {
  spaces: KbSpace[];
  templates: KbPageSummary[];
  favorites: KbPageSummary[];
  recents: KbPageSummary[];
  updated: KbPageSummary[];
  canDelete: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<KbPageSummary[] | null>(null);
  const [newPage, setNewPage] = useState(false);
  const [newSpace, setNewSpace] = useState(false);
  useNewParam(() => setNewPage(true));

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/kb/pages?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { pages?: KbPageSummary[] }) => setResults(d.pages ?? []))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <Page
      title="Wiki"
      actions={
        <>
          <Menu
            label="New"
            trigger={
              <NavButton label="New">
                <Plus className="h-5 w-5" />
              </NavButton>
            }
            items={[
              { label: "New Page", icon: Plus, onSelect: () => setNewPage(true) },
              { label: "New Space", icon: FolderPlus, onSelect: () => setNewSpace(true) },
            ]}
          />
        </>
      }
      accessory={<SearchField value={q} onChange={setQ} placeholder="Search all pages" />}
    >
      {results ? (
        <ListSection header={`${results.length} result${results.length === 1 ? "" : "s"}`}>
          {results.map((p) => (
            <PageRow key={p.id} p={p} subtitle={`${p.spaceName} · ${p.snippet?.replace(/\n/g, " ") ?? ""}`} />
          ))}
          {results.length === 0 && <ListRow title="No pages match" />}
        </ListSection>
      ) : (
        <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <div className="mb-7 grid grid-cols-2 gap-3">
              {spaces.map((s) => (
                <Link key={s.id} href={`/wiki/s/${s.id}`} className="press rounded-[16px] bg-bg-elevated p-3.5 shadow-widget dark:shadow-none">
                  <SpaceIcon icon={s.icon} color={s.color} />
                  <div className="mt-3 truncate text-headline">{s.name}</div>
                  <div className="text-footnote text-label-2">
                    {s.pageCount} page{s.pageCount === 1 ? "" : "s"}
                  </div>
                </Link>
              ))}
              <button type="button" onClick={() => setNewSpace(true)} className="press flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-[16px] border border-dashed border-separator text-subhead text-accent">
                <FolderPlus className="h-6 w-6" />
                New Space
              </button>
            </div>
            {favorites.length > 0 && (
              <ListSection header={<span className="flex items-center gap-1"><Star className="h-3 w-3 fill-current" /> Favorites</span>}>
                {favorites.map((p) => (
                  <PageRow key={p.id} p={p} />
                ))}
              </ListSection>
            )}
          </div>
          <div>
            {recents.length > 0 && (
              <ListSection header="Recently Viewed">
                {recents.map((p) => (
                  <PageRow key={p.id} p={p} />
                ))}
              </ListSection>
            )}
            <ListSection header="Recently Edited">
              {updated.map((p) => (
                <PageRow key={p.id} p={p} subtitle={`${p.spaceName} · ${timeAgo(p.updatedAt)}`} />
              ))}
            </ListSection>
            <ListSection header="Templates" footer="Start new pages from a template with the + button.">
              {templates.map((p) => (
                <PageRow key={p.id} p={p} subtitle="Template" />
              ))}
            </ListSection>
          </div>
        </div>
      )}
      <NewPageSheet open={newPage} onOpenChange={setNewPage} spaces={spaces} templates={templates} />
      <SpaceSheet open={newSpace} onOpenChange={setNewSpace} canDelete={canDelete} />
    </Page>
  );
}
