/**
 * The search result shape and its labels, kept free of any `lib/data` import.
 *
 * The command palette is a client component, so anything it imports as a
 * *value* lands in the browser bundle. Pulling these from lib/data/search.ts
 * dragged the whole store — and Node's `crypto` — along with them, which fails
 * at runtime with "randomUUID is not a function". Same rule as lib/validators:
 * one module, both sides, no server-only imports at the top.
 */
export type SearchResultType =
  | "client"
  | "project"
  | "document"
  | "deal"
  | "meeting"
  | "task"
  | "hosting"
  | "venture"
  | "party"
  | "campaign"
  | "secret";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  href: string;
  score: number;
};

const TYPE_LABELS: Record<SearchResultType, string> = {
  client: "Clients",
  project: "Projects",
  document: "Documents",
  deal: "Deals",
  meeting: "Meetings",
  task: "Tasks",
  hosting: "Hosting",
  venture: "Ventures",
  party: "Payout parties",
  campaign: "Campaigns",
  secret: "Vault",
};

export function searchResultGroupLabel(type: SearchResultType): string {
  return TYPE_LABELS[type];
}
