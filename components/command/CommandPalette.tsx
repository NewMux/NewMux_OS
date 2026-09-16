"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
} from "@/components/ui/Command";
import { NavIcon } from "@/components/shell/NavIcon";
import { navItemsForRole } from "@/lib/nav";
import { pushRecent, readRecent, type RecentEntry } from "@/lib/palette/recent";
import {
  searchResultGroupLabel,
  type SearchResult,
  type SearchResultType,
} from "@/lib/search/types";
import type { UserRole } from "@/lib/data/types";
import {
  ArrowRight,
  Clock,
  FilePlus2,
  FolderPlus,
  Target,
  UserPlus,
} from "lucide-react";

const QUICK_ACTIONS: { href: string; label: string; icon: typeof FilePlus2; roles: UserRole[] }[] = [
  { href: "/documents/new", label: "New document", icon: FilePlus2, roles: ["partner_admin"] },
  { href: "/pipeline", label: "New lead", icon: Target, roles: ["partner_admin"] },
  { href: "/clients", label: "New client", icon: UserPlus, roles: ["partner_admin"] },
  { href: "/projects", label: "New project", icon: FolderPlus, roles: ["partner_admin", "lead_dev"] },
];

const fetcher = (url: string) =>
  fetch(url).then((res) => (res.ok ? res.json() : { results: [] }));

/** Typing in a field should type, not open the palette. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CommandPalette({ role }: { role: UserRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const debouncedQuery = useDebounced(query.trim(), 150);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      if (!open && isEditable(event.target)) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // localStorage is only safe to touch on the client, and only while open, so
  // the list reflects what the user actually visited this session.
  useEffect(() => {
    if (open) setRecent(readRecent());
    else setQuery("");
  }, [open]);

  const { data, isLoading } = useSWR<{ results: SearchResult[] }>(
    debouncedQuery ? `/api/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  const navItems = useMemo(() => navItemsForRole(role), [role]);
  const actions = useMemo(
    () => QUICK_ACTIONS.filter((a) => a.roles.includes(role)),
    [role],
  );

  const go = useCallback(
    (entry: RecentEntry) => {
      pushRecent(entry);
      setOpen(false);
      router.push(entry.href);
    },
    [router],
  );

  const grouped = useMemo(() => {
    const groups = new Map<SearchResultType, SearchResult[]>();
    for (const result of data?.results ?? []) {
      const existing = groups.get(result.type);
      if (existing) existing.push(result);
      else groups.set(result.type, [result]);
    }
    return [...groups.entries()];
  }, [data]);

  const searching = debouncedQuery.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} label="Command palette">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search clients, projects, documents… or jump to a page"
      />
      <CommandList className="max-h-[60vh] overflow-y-auto overscroll-contain">
        {searching && isLoading && !data && (
          <CommandLoading className="px-3 py-6 text-center text-sm text-muted-foreground">
            Searching…
          </CommandLoading>
        )}

        {searching && !isLoading && grouped.length === 0 && (
          <CommandEmpty className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing matches “{debouncedQuery}”.
          </CommandEmpty>
        )}

        {searching &&
          grouped.map(([type, results]) => (
            <CommandGroup key={type} heading={searchResultGroupLabel(type)}>
              {results.map((result) => (
                <CommandItem
                  key={`${type}:${result.id}`}
                  value={`${type}:${result.id}`}
                  onSelect={() =>
                    go({ title: result.title, subtitle: result.subtitle, href: result.href })
                  }
                >
                  <span className="min-w-0 flex-1 truncate">{result.title}</span>
                  {result.subtitle && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {result.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

        {!searching && (
          <>
            <CommandGroup heading="Actions">
              {actions.map((action) => (
                <CommandItem
                  key={action.href}
                  value={action.label}
                  onSelect={() => go({ title: action.label, subtitle: null, href: action.href })}
                >
                  <action.icon className="h-4 w-4 text-brand" aria-hidden />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>

            {recent.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent">
                  {recent.map((entry) => (
                    <CommandItem key={entry.href} value={entry.href} onSelect={() => go(entry)}>
                      <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                      {entry.subtitle && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {entry.subtitle}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            {/* Sourced from lib/nav.ts, so the palette can never drift from
                the sidebar or offer a page this role cannot open. */}
            <CommandGroup heading="Go to">
              {navItems.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => go({ title: item.label, subtitle: null, href: item.href })}
                >
                  <NavIcon icon={item.icon} className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
