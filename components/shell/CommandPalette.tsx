"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import type { SearchResult } from "@/lib/data/search";
import type { NavLink } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { RESULT_META, groupResults } from "./SearchResults";
import { IconTile } from "@/components/ui/List";

/** ⌘K spotlight: jump to any screen or search every module. Desktop/iPad keyboard. */
export function CommandPalette({ links }: { links: NavLink[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { results?: SearchResult[] }) => setResults(d.results ?? []))
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/10 animate-fade-in" />
        {/* Spotlight: one glass field, results grouped by kind underneath. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="glass-thick fixed left-1/2 top-[14vh] z-[91] w-[min(680px,92vw)] -translate-x-1/2 overflow-hidden rounded-[26px] animate-pop-in focus:outline-none"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-3 px-5">
              <Search className="h-6 w-6 text-label-2" strokeWidth={2.2} />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder="Search NEWMUX"
                className="h-[62px] flex-1 bg-transparent text-title3 font-normal placeholder:text-label-3 focus:outline-none"
              />
              <kbd className="rounded-md bg-fill/[0.14] px-1.5 py-0.5 font-sans text-caption1 text-label-2">esc</kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto border-t-[0.5px] border-separator p-2 empty:hidden">
              {q && <Command.Empty className="px-3 py-8 text-center text-subhead text-label-2">No results for “{q}”</Command.Empty>}
              {groupResults(results).map(([kind, items]) => (
                <Command.Group key={kind} heading={RESULT_META[kind].label} className={GROUP}>
                  {items.map((r) => (
                    <Command.Item key={`${r.kind}-${r.id}`} value={`${r.kind}-${r.id}`} onSelect={() => go(r.href)} className={ITEM}>
                      <IconTile icon={RESULT_META[r.kind].icon} color={RESULT_META[r.kind].color} size="sm" />
                      <span className="truncate text-body">{r.title}</span>
                      {r.subtitle && <span className="ml-auto shrink-0 truncate pl-3 text-footnote opacity-60">{r.subtitle}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
              <Command.Group heading="Go to" className={GROUP}>
                {links
                  .filter((l) => !q || l.label.toLowerCase().includes(q.toLowerCase()))
                  .map((l) => (
                    <Command.Item key={l.href} value={`nav-${l.href}`} onSelect={() => go(l.href)} className={ITEM}>
                      <span className="flex h-6 w-6 items-center justify-center">
                        <NavIcon icon={l.icon} className="h-[18px] w-[18px] opacity-70" />
                      </span>
                      <span className="text-body">{l.label}</span>
                    </Command.Item>
                  ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const GROUP = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-footnote [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-label-2";
const ITEM = "flex h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 data-[selected=true]:bg-accent data-[selected=true]:text-white";
