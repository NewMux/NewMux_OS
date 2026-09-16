/**
 * Search, filter and sort for list pages, driven entirely by URL search params.
 *
 * Params live in the URL rather than component state so a filtered view is
 * shareable, survives a reload, and the back button steps through it — the
 * convention the documents type filter already used. Pages stay
 * server components; only the toolbar that writes the params is a client one.
 */

export type SortDirection = "asc" | "desc";

export type ListParams = {
  /** Free-text search, already trimmed and lowercased. */
  q: string;
  /** Key into the page's `sorters` map, or null for its default order. */
  sort: string | null;
  dir: SortDirection;
  /** Named filters, e.g. `{ status: "active" }`. Absent keys mean "all". */
  filters: Record<string, string>;
  /** Show archived rows instead of active ones. */
  archived: boolean;
};

export type SearchParamRecord = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseListParams(
  searchParams: SearchParamRecord,
  options: { filterKeys?: readonly string[] } = {},
): ListParams {
  const filters: Record<string, string> = {};
  for (const key of options.filterKeys ?? []) {
    const value = first(searchParams[key]);
    // "all" is the absence of a filter, not a value to match against.
    if (value && value !== "all") filters[key] = value;
  }

  return {
    q: (first(searchParams.q) ?? "").trim().toLowerCase(),
    sort: first(searchParams.sort) ?? null,
    dir: first(searchParams.dir) === "asc" ? "asc" : "desc",
    filters,
    archived: first(searchParams.archived) === "1",
  };
}

export type ListQueryConfig<T> = {
  /** Fields the search box matches against. Nullish entries are skipped. */
  searchFields: (row: T) => (string | null | undefined)[];
  /** Named comparators, always written ascending; `dir` flips them. */
  sorters?: Record<string, (a: T, b: T) => number>;
  /** Named predicates matching the keys passed to `parseListParams`. */
  filters?: Record<string, (row: T, value: string) => boolean>;
  /** Supply this for entities that can be archived. */
  isArchived?: (row: T) => boolean;
};

export function applyListQuery<T>(
  rows: T[],
  params: ListParams,
  config: ListQueryConfig<T>,
): T[] {
  let result = rows;

  if (config.isArchived) {
    const isArchived = config.isArchived;
    result = result.filter((row) => isArchived(row) === params.archived);
  }

  for (const [key, value] of Object.entries(params.filters)) {
    const predicate = config.filters?.[key];
    if (predicate) result = result.filter((row) => predicate(row, value));
  }

  if (params.q) {
    result = result.filter((row) =>
      config.searchFields(row).some((field) => field?.toLowerCase().includes(params.q)),
    );
  }

  if (params.sort) {
    const compare = config.sorters?.[params.sort];
    if (compare) {
      // Copy first: these arrays are the live store's, and sort mutates.
      result = [...result].sort((a, b) => (params.dir === "asc" ? compare(a, b) : compare(b, a)));
    }
  }

  return result;
}

/** Case-insensitive text comparator for a `sorters` map. */
export function byText<T>(get: (row: T) => string | null | undefined) {
  return (a: T, b: T) => (get(a) ?? "").localeCompare(get(b) ?? "", undefined, { sensitivity: "base" });
}

/** Comparator for a number field, nullish last. */
export function byNumber<T>(get: (row: T) => number | null | undefined) {
  return (a: T, b: T) => (get(a) ?? 0) - (get(b) ?? 0);
}

/** Comparator for an ISO date field; rows with no date sort last either way. */
export function byDate<T>(get: (row: T) => string | null | undefined) {
  return (a: T, b: T) => {
    const x = get(a);
    const y = get(b);
    if (!x && !y) return 0;
    if (!x) return 1;
    if (!y) return -1;
    return x < y ? -1 : x > y ? 1 : 0;
  };
}

/** Whether any control is narrowing the list, for "no results" vs "nothing here yet". */
export function isFiltered(params: ListParams): boolean {
  return params.q !== "" || Object.keys(params.filters).length > 0;
}

/** Serialize params back to a query string, for export links. */
export function toSearchString(params: ListParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.sort) {
    sp.set("sort", params.sort);
    sp.set("dir", params.dir);
  }
  for (const [key, value] of Object.entries(params.filters)) sp.set(key, value);
  if (params.archived) sp.set("archived", "1");
  return sp.toString();
}
