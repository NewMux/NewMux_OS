"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type ToolbarFilter = {
  /** URL param name, matching a key passed to parseListParams. */
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export type ToolbarSort = { value: string; label: string };

/**
 * Search, filter, sort, archived toggle and CSV export for a list page.
 *
 * Every control writes to the URL, so the page itself stays a server
 * component and a narrowed view is shareable and back-button-correct. Search
 * is debounced and replaces rather than pushes, so typing a query does not
 * bury the previous page under a dozen history entries.
 */
export function ListToolbar({
  searchPlaceholder = "Search…",
  filters = [],
  sorts = [],
  archivedCount,
  exportType,
  className,
}: {
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  sorts?: ToolbarSort[];
  /** Omit entirely for entities that cannot be archived. */
  archivedCount?: number;
  /** Report id in lib/reports/registry.ts; omit to hide the export button. */
  exportType?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  // Keep the box in step with Back/Forward, but never fight the user mid-type.
  const typing = useRef(false);
  useEffect(() => {
    if (!typing.current) setQuery(urlQuery);
  }, [urlQuery]);

  function navigate(mutate: (params: URLSearchParams) => void, replace = false) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const search = params.toString();
    const href = search ? `${pathname}?${search}` : pathname;
    startTransition(() => {
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  }

  useEffect(() => {
    if (query === urlQuery) return;
    typing.current = true;
    const timer = setTimeout(() => {
      navigate((params) => {
        if (query) params.set("q", query);
        else params.delete("q");
      }, true);
      typing.current = false;
    }, 250);
    return () => clearTimeout(timer);
    // navigate closes over searchParams, which changes on every keystroke's
    // replace; depending on it would restart the debounce forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  const archived = searchParams.get("archived") === "1";
  const sort = searchParams.get("sort") ?? "";
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const exportHref = exportType
    ? `/api/reports/export?type=${encodeURIComponent(exportType)}&${searchParams.toString()}`
    : null;

  const selectClass =
    "min-h-[44px] rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-[12rem] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filters.map((filter) => (
        <label key={filter.key} className="contents">
          <span className="sr-only">{filter.label}</span>
          <select
            aria-label={filter.label}
            className={selectClass}
            value={searchParams.get(filter.key) ?? "all"}
            onChange={(e) =>
              navigate((params) => {
                if (e.target.value === "all") params.delete(filter.key);
                else params.set(filter.key, e.target.value);
              })
            }
          >
            <option value="all">{filter.label}: all</option>
            {filter.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {sorts.length > 0 && (
        <select
          aria-label="Sort by"
          className={selectClass}
          value={sort ? `${sort}:${dir}` : ""}
          onChange={(e) =>
            navigate((params) => {
              if (!e.target.value) {
                params.delete("sort");
                params.delete("dir");
                return;
              }
              const [nextSort, nextDir] = e.target.value.split(":");
              params.set("sort", nextSort ?? "");
              params.set("dir", nextDir ?? "desc");
            })
          }
        >
          <option value="">Default order</option>
          {sorts.flatMap((s) => [
            <option key={`${s.value}:asc`} value={`${s.value}:asc`}>
              {s.label} ↑
            </option>,
            <option key={`${s.value}:desc`} value={`${s.value}:desc`}>
              {s.label} ↓
            </option>,
          ])}
        </select>
      )}

      {archivedCount !== undefined && (archivedCount > 0 || archived) && (
        <Button
          type="button"
          variant={archived ? "default" : "secondary"}
          size="sm"
          aria-pressed={archived}
          onClick={() =>
            navigate((params) => {
              if (archived) params.delete("archived");
              else params.set("archived", "1");
            })
          }
        >
          Archived ({archivedCount})
        </Button>
      )}

      {exportHref && (
        <Button asChild variant="secondary" size="sm">
          <a href={exportHref} download>
            <Download className="h-4 w-4" /> CSV
          </a>
        </Button>
      )}

      {pending && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Updating list" />
      )}
    </div>
  );
}
