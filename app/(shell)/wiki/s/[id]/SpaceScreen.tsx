"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, FileText, Pencil, Plus } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { Menu } from "@/components/ui/Menu";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpaceIcon } from "@/components/wiki/SpaceIcon";
import { NewPageSheet, SpaceSheet } from "@/components/wiki/WikiSheets";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { KbPageSummary, KbSpace } from "@/lib/data/types";

type Node = KbPageSummary & { children: Node[] };

function buildTree(pages: KbPageSummary[]): Node[] {
  const nodes = new Map<string, Node>(pages.map((p) => [p.id, { ...p, children: [] }]));
  const roots: Node[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    (parent ? parent.children : roots).push(n);
  }
  return roots;
}

function TreeRow({ node, depth }: { node: Node; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasKids = node.children.length > 0;
  return (
    <>
      <div className="flex items-stretch [&:last-child_.row-sep]:shadow-none" style={{ paddingLeft: 8 + depth * 20 }}>
        <button
          type="button"
          aria-label={open ? "Collapse" : "Expand"}
          onClick={() => setOpen((o) => !o)}
          className={cn("flex w-7 shrink-0 items-center justify-center text-label-3", !hasKids && "invisible")}
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} strokeWidth={2.5} />
        </button>
        <Link href={`/wiki/${node.id}`} className="row-sep flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 pr-4 shadow-[inset_0_-0.5px_0_rgb(var(--separator))] active:bg-fill/10">
          <span className="text-[20px]">{node.emoji ?? "📄"}</span>
          <span className="min-w-0 flex-1 truncate text-body">{node.title || "Untitled"}</span>
          <span className="shrink-0 text-footnote text-label-2">{timeAgo(node.updatedAt)}</span>
        </Link>
      </div>
      {open && node.children.map((c) => <TreeRow key={c.id} node={c} depth={depth + 1} />)}
    </>
  );
}

export function SpaceScreen({ space, pages, spaces, templates, canDelete }: { space: KbSpace; pages: KbPageSummary[]; spaces: KbSpace[]; templates: KbPageSummary[]; canDelete: boolean }) {
  const tree = useMemo(() => buildTree(pages), [pages]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <Page
      title={space.name}
      back={{ href: "/wiki", label: "Wiki" }}
      subtitle={space.description}
      actions={
        <>
          <NavButton label="New page" onClick={() => setCreating(true)}>
            <Plus className="h-5 w-5" />
          </NavButton>
          <Menu items={[{ label: "Edit Space", icon: Pencil, onSelect: () => setEditing(true) }]} />
        </>
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center gap-3">
          <SpaceIcon icon={space.icon} color={space.color} size="lg" />
          <span className="text-subhead text-label-2">
            {pages.length} page{pages.length === 1 ? "" : "s"}
          </span>
        </div>
        {tree.length === 0 ? (
          <EmptyState icon={FileText} title="No pages yet" message="Create the first page in this space." />
        ) : (
          <div className="overflow-hidden rounded-card bg-bg-elevated">
            {tree.map((n) => (
              <TreeRow key={n.id} node={n} depth={0} />
            ))}
          </div>
        )}
      </div>
      <NewPageSheet open={creating} onOpenChange={setCreating} spaces={spaces} templates={templates} defaultSpaceId={space.id} />
      <SpaceSheet space={space} open={editing} onOpenChange={setEditing} canDelete={canDelete} />
    </Page>
  );
}
