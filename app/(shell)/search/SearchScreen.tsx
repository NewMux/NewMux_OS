"use client";

import { useEffect, useState } from "react";
import { SearchX, Sparkles } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { SearchField } from "@/components/ui/SearchField";
import { ListSection } from "@/components/ui/List";
import { EmptyState } from "@/components/ui/EmptyState";
import { RESULT_META, ResultRow, groupResults } from "@/components/shell/SearchResults";
import type { SearchResult } from "@/lib/data/search";

export function SearchScreen() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { results?: SearchResult[] }) => setResults(d.results ?? []))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <Page title="Search" accessory={<SearchField value={q} onChange={setQ} autoFocus placeholder="Clients, deals, tasks, invoices, wiki" />}>
      {results === null && (
        <EmptyState icon={Sparkles} title="Search everything" message="Clients, contacts, deals, projects, tasks, invoices and wiki pages — all in one place." />
      )}
      {results?.length === 0 && <EmptyState icon={SearchX} title={`No results for “${q}”`} message="Check the spelling or try a new search." />}
      {results &&
        groupResults(results).map(([kind, items]) => (
          <ListSection key={kind} header={RESULT_META[kind].label}>
            {items.map((r) => (
              <ResultRow key={`${r.kind}-${r.id}`} result={r} />
            ))}
          </ListSection>
        ))}
    </Page>
  );
}
