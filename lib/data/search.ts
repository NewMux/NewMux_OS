import type { Session } from "next-auth";
import { store } from "./store";
import {
  canAccessDocuments,
  canAccessFinance,
  canAccessGrowth,
  isPartnerAdmin,
} from "@/lib/rbac";
import { centsToDisplay } from "@/lib/money";
import type { SearchResult, SearchResultType } from "@/lib/search/types";

export type { SearchResult, SearchResultType } from "@/lib/search/types";
export { searchResultGroupLabel } from "@/lib/search/types";

/**
 * Cross-entity search behind the command palette.
 *
 * Scored in memory with a normalized substring match and a prefix boost. The
 * store is a few hundred rows, so an index or a fuzzy library would cost more
 * than it saves; if this ever moves to Postgres the scorer goes with the
 * query, not the caller.
 *
 * Two rules are load-bearing:
 *  - Vault secrets are matched on their **label only**. The ciphertext and the
 *    masked preview never enter the index, so nothing here can leak a value
 *    that /api/vault/[id]/reveal would have refused.
 *  - Every source is gated by the same lib/rbac predicate the page uses, so a
 *    lead_dev cannot find a finance or vault row by typing its name.
 */
function normalize(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      // Strip combining marks so "Voyà" matches "voya"; Arabic names keep their
      // letters because only marks are removed, not characters.
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  );
}

/**
 * 0 means no match. An exact hit beats a prefix, which beats a word-start,
 * which beats a substring; shorter fields win ties so "Voya" ranks above
 * "Voya Travel Platform phase 2" for the query "voya".
 */
function scoreField(field: string | null | undefined, query: string): number {
  if (!field) return 0;
  const haystack = normalize(field);
  if (!haystack) return 0;

  const index = haystack.indexOf(query);
  if (index === -1) return 0;

  let base: number;
  if (haystack === query) base = 100;
  else if (index === 0) base = 70;
  else if (haystack[index - 1] === " ") base = 50;
  else base = 30;

  // Tie-break toward tighter matches, but never enough to cross a tier.
  return base + Math.max(0, 10 - haystack.length / 10);
}

/** Best score across a record's searchable fields, weighted by field rank. */
function scoreRecord(
  fields: (string | null | undefined)[],
  query: string,
): number {
  let best = 0;
  for (const [position, field] of fields.entries()) {
    // Later fields are secondary (a note, a phone number), so they score lower.
    const score = scoreField(field, query) * (position === 0 ? 1 : 0.6);
    if (score > best) best = score;
  }
  return best;
}

export async function searchAll(
  rawQuery: string,
  session: Session | null,
  options: { limit?: number } = {},
): Promise<SearchResult[]> {
  const query = normalize(rawQuery);
  if (!session || query.length === 0) return [];

  const limit = options.limit ?? 20;
  const results: SearchResult[] = [];

  const push = (
    fields: (string | null | undefined)[],
    result: Omit<SearchResult, "score">,
  ) => {
    const score = scoreRecord(fields, query);
    if (score > 0) results.push({ ...result, score });
  };

  const clientName = (id: string | null) =>
    id ? (store.clients.find((c) => c.id === id)?.name ?? null) : null;

  if (canAccessFinance(session)) {
    for (const c of store.clients) {
      if (c.archivedAt) continue;
      push(
        [c.name, c.nameArabic, c.clientCode, c.contactPerson, c.contactEmail],
        {
          id: c.id,
          type: "client",
          title: c.name,
          subtitle: c.clientCode,
          href: `/clients/${c.id}`,
        },
      );
    }

    for (const h of store.hostingSubscriptions) {
      const name = clientName(h.clientId);
      push([name, h.item], {
        id: h.id,
        type: "hosting",
        title: `${name ?? "Unknown client"} · ${h.item}`,
        subtitle: `${centsToDisplay(h.amountCents, h.currency)} / ${h.cycle}`,
        href: "/hosting",
      });
    }

    for (const v of store.ventures) {
      push([v.name, v.brandDescription], {
        id: v.id,
        type: "venture",
        title: v.name,
        subtitle: v.launchStatus.replace("_", " "),
        href: `/ventures/${v.id}`,
      });
    }

    for (const d of store.deals) {
      push([d.name, d.contactPerson, d.contactEmail, d.notes], {
        id: d.id,
        type: "deal",
        title: d.name,
        subtitle: `${d.stage.replace("_", " ")} · ${centsToDisplay(d.quotedValueCents, d.currency)}`,
        href: `/pipeline/${d.id}`,
      });
    }

    for (const p of store.parties) {
      push([p.name], {
        id: p.id,
        type: "party",
        title: p.name,
        subtitle: "Payout party",
        href: "/settings",
      });
    }
  }

  if (canAccessDocuments(session)) {
    for (const d of store.documents) {
      if (d.archivedAt) continue;
      push([d.documentNumber, clientName(d.clientId), d.notes], {
        id: d.id,
        type: "document",
        title: d.documentNumber,
        subtitle: `${clientName(d.clientId) ?? "Unknown client"} · ${centsToDisplay(d.totalCents, d.currency)}`,
        href: `/documents/${d.id}`,
      });
    }
  }

  // Projects, meetings and tasks are shared team context: both roles see them.
  for (const p of store.projects) {
    if (p.archivedAt) continue;
    push([p.name, p.techStack, p.domain, p.hostingProvider], {
      id: p.id,
      type: "project",
      title: p.name,
      subtitle: clientName(p.clientId) ?? "Internal",
      href: `/projects/${p.id}`,
    });
  }

  for (const m of store.meetings) {
    push([m.title, m.notes], {
      id: m.id,
      type: "meeting",
      title: m.title,
      subtitle: new Date(m.startsAt).toLocaleString(),
      href: "/meetings",
    });
  }

  for (const t of store.tasks) {
    if (t.status === "done") continue;
    const project = store.projects.find((p) => p.id === t.projectId);
    push([t.title, t.description], {
      id: t.id,
      type: "task",
      title: t.title,
      subtitle: project?.name ?? null,
      href: project ? `/projects/${project.id}` : "/meetings",
    });
  }

  if (canAccessGrowth(session)) {
    for (const c of store.campaigns) {
      push([c.name, c.channel], {
        id: c.id,
        type: "campaign",
        title: c.name,
        subtitle: c.channel.replace("_", " "),
        href: "/growth",
      });
    }
  }

  if (isPartnerAdmin(session)) {
    for (const s of store.secrets) {
      // Label only — never ciphertext, never maskedPreview.
      push([s.label], {
        id: s.id,
        type: "secret",
        title: s.label,
        subtitle: "Vault credential",
        href: "/vault",
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
