"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import type { SearchResult } from "@/lib/data/search";
import type { NavLink } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { RESULT_META } from "./SearchResults";

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
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/20 animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-[91] w-[min(640px,92vw)] -translate-x-1/2 overflow-hidden rounded-2xl bg-bg-elevated/90 shadow-float backdrop-blur-2xl animate-scale-in focus:outline-none"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-3 px-4 hairline-b">
              <Search className="h-5 w-5 text-label-2" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder="Search clients, deals, tasks, invoices, wiki…"
                className="h-14 flex-1 bg-transparent text-title3 font-normal placeholder:text-label-3 focus:outline-none"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-subhead text-label-2">No results</Command.Empty>
              {results.length > 0 && (
                <Command.Group heading="Results" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-caption1 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-label-2">
                  {results.map((r) => {
                    const Icon = RESULT_META[r.kind].icon;
                    return (
                      <Command.Item
                        key={`${r.kind}-${r.id}`}
                        value={`${r.kind}-${r.id}`}
                        onSelect={() => go(r.href)}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 data-[selected=true]:bg-accent data-[selected=true]:text-white"
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="truncate text-body">{r.title}</span>
                        {r.subtitle && <span className="ml-auto shrink-0 truncate text-footnote opacity-60">{r.subtitle}</span>}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-caption1 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-label-2">
                {links
                  .filter((l) => !q || l.label.toLowerCase().includes(q.toLowerCase()))
                  .map((l) => (
                    <Command.Item
                      key={l.href}
                      value={`nav-${l.href}`}
                      onSelect={() => go(l.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 data-[selected=true]:bg-accent data-[selected=true]:text-white"
                    >
                      <NavIcon icon={l.icon} className="h-4 w-4 opacity-70" />
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
