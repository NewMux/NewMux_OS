import { many } from "./sql";
import { searchPages } from "./kb";
import type { UserRole } from "./types";

export type SearchResult = {
  kind: "client" | "contact" | "deal" | "project" | "task" | "document" | "page";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

/**
 * Global search across every module. Name-like fields use ILIKE; wiki pages
 * use the full-text index. CRM and Finance results are only returned to
 * roles that can open them.
 */
export async function globalSearch(term: string, role: UserRole, limit = 6): Promise<SearchResult[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const admin = role === "partner_admin";

  const queries: Promise<SearchResult[]>[] = [
    many<SearchResult>(
      `select 'project' as kind, p.id, p.name as title, c.name as subtitle, '/projects/' || p.id as href
       from projects p left join clients c on c.id = p.client_id
       where p.name ilike $1 or p.domain ilike $1 order by p.name limit $2`,
      [like, limit],
    ),
    many<SearchResult>(
      `select 'task' as kind, t.id, t.title, p.name as subtitle, '/projects/' || p.id || '?task=' || t.id as href
       from tasks t join projects p on p.id = t.project_id
       where t.title ilike $1 or t.description ilike $1 order by t.status = 'done', t.updated_at desc limit $2`,
      [like, limit],
    ),
    searchPages(q, limit).then((pages) =>
      pages.map((p) => ({
        kind: "page" as const,
        id: p.id,
        title: `${p.emoji ? `${p.emoji} ` : ""}${p.title || "Untitled"}`,
        subtitle: p.spaceName ?? null,
        href: `/wiki/${p.id}`,
      })),
    ),
  ];

  if (admin) {
    queries.unshift(
      many<SearchResult>(
        `select 'client' as kind, id, name as title, client_code as subtitle, '/clients/' || id as href
         from clients where name ilike $1 or client_code ilike $1 or email ilike $1 order by name limit $2`,
        [like, limit],
      ),
      many<SearchResult>(
        `select 'contact' as kind, ct.id, ct.full_name as title, coalesce(ct.title || ' · ', '') || coalesce(c.name, '') as subtitle,
           '/contacts/' || ct.id as href
         from contacts ct left join clients c on c.id = ct.client_id
         where ct.full_name ilike $1 or ct.email ilike $1 or ct.phone ilike $1 order by ct.full_name limit $2`,
        [like, limit],
      ),
      many<SearchResult>(
        `select 'deal' as kind, d.id, d.title, coalesce(c.name, '') || ' · ' || d.stage as subtitle, '/crm/deals/' || d.id as href
         from deals d left join clients c on c.id = d.client_id
         where d.title ilike $1 order by d.updated_at desc limit $2`,
        [like, limit],
      ),
      many<SearchResult>(
        `select 'document' as kind, d.id, d.document_number as title, c.name || ' · ' || d.status as subtitle, '/documents/' || d.id as href
         from documents d join clients c on c.id = d.client_id
         where d.document_number ilike $1 or c.name ilike $1 order by d.created_at desc limit $2`,
        [like, limit],
      ),
    );
  }

  return (await Promise.all(queries)).flat();
}
