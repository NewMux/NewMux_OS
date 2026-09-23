import { query, tx } from "@/lib/db";
import { many, one, must, NotFoundError, ValidationError } from "./sql";
import type { KbContent, KbPage, KbPageSummary, KbSpace } from "./types";

// --- Spaces ---

export async function listSpaces(): Promise<KbSpace[]> {
  return many<KbSpace>(
    `select s.*, (select count(*)::int from kb_pages p where p.space_id = s.id and not p.is_template) as page_count
     from kb_spaces s order by s.sort_order, s.name`,
  );
}

export async function getSpaceById(id: string): Promise<KbSpace | undefined> {
  return one<KbSpace>("select * from kb_spaces where id = $1", [id]);
}

export type SpaceInput = { name: string; description?: string | null; icon: string; color: string };

export async function createSpace(input: SpaceInput): Promise<KbSpace> {
  return must<KbSpace>(
    "Space",
    `insert into kb_spaces (name, description, icon, color, sort_order)
     values ($1,$2,$3,$4, coalesce((select max(sort_order) + 1 from kb_spaces), 0)) returning *`,
    [input.name, input.description ?? null, input.icon, input.color],
  );
}

export async function updateSpace(id: string, input: SpaceInput): Promise<KbSpace> {
  return must<KbSpace>("Space", "update kb_spaces set name = $2, description = $3, icon = $4, color = $5 where id = $1 returning *", [
    id,
    input.name,
    input.description ?? null,
    input.icon,
    input.color,
  ]);
}

export async function deleteSpace(id: string): Promise<void> {
  const rows = await query("delete from kb_spaces where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Space");
}

// --- Pages ---

const SUMMARY_COLS = "p.id, p.space_id, p.parent_id, p.title, p.emoji, p.is_template, p.sort_order, p.updated_at";

export async function listPagesInSpace(spaceId: string): Promise<KbPageSummary[]> {
  return many<KbPageSummary>(
    `select ${SUMMARY_COLS} from kb_pages p where p.space_id = $1 and not p.is_template order by p.sort_order, lower(p.title)`,
    [spaceId],
  );
}

export async function listTemplates(): Promise<KbPageSummary[]> {
  return many<KbPageSummary>(`select ${SUMMARY_COLS} from kb_pages p where p.is_template order by p.title`);
}

export async function listLinkedPages(link: { clientId?: string; projectId?: string; dealId?: string }): Promise<KbPageSummary[]> {
  const [col, value] = link.clientId
    ? ["client_id", link.clientId]
    : link.projectId
      ? ["project_id", link.projectId]
      : ["deal_id", link.dealId];
  return many<KbPageSummary>(
    `select ${SUMMARY_COLS}, s.name as space_name from kb_pages p join kb_spaces s on s.id = p.space_id
     where p.${col} = $1 and not p.is_template order by p.updated_at desc`,
    [value],
  );
}

export async function getPageById(id: string): Promise<KbPage | undefined> {
  return one<KbPage>(
    "select p.*, u.full_name as updated_by_name from kb_pages p left join users u on u.id = p.updated_by where p.id = $1",
    [id],
  );
}

/** Ancestors from the root down to the page's parent, for breadcrumbs. */
export async function getPageAncestors(id: string): Promise<{ id: string; title: string; emoji: string | null }[]> {
  return many(
    `with recursive chain as (
       select id, parent_id, title, emoji, 0 as depth from kb_pages where id = (select parent_id from kb_pages where id = $1)
       union all
       select p.id, p.parent_id, p.title, p.emoji, c.depth + 1 from kb_pages p join chain c on p.id = c.parent_id
     )
     select id, title, emoji from chain order by depth desc`,
    [id],
  );
}

export async function listChildPages(id: string): Promise<KbPageSummary[]> {
  return many<KbPageSummary>(`select ${SUMMARY_COLS} from kb_pages p where p.parent_id = $1 order by p.sort_order, lower(p.title)`, [id]);
}

/** Plain text of a TipTap JSON document, one block per line — used for search and snippets. */
export function extractText(content: KbContent | undefined | null): string {
  const lines: string[] = [];
  const walk = (node: unknown, buf: string[]): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") buf.push(n.text);
    if (Array.isArray(n.content)) {
      const isBlockContainer = n.content.some((c) => c && typeof c === "object" && !("text" in (c as object)));
      if (isBlockContainer) {
        for (const child of n.content) {
          const childBuf: string[] = [];
          walk(child, childBuf);
          if (childBuf.length) lines.push(childBuf.join(""));
        }
      } else {
        for (const child of n.content) walk(child, buf);
      }
    }
  };
  const top: string[] = [];
  walk(content, top);
  if (top.length) lines.push(top.join(""));
  return lines.join("\n").slice(0, 200_000);
}

const EMPTY_DOC: KbContent = { type: "doc", content: [{ type: "paragraph" }] };

export async function createPage(
  input: {
    spaceId: string;
    parentId?: string | null;
    title?: string;
    emoji?: string | null;
    templateId?: string | null;
    clientId?: string | null;
    projectId?: string | null;
    dealId?: string | null;
    isTemplate?: boolean;
    content?: KbContent;
  },
  createdBy: string,
): Promise<KbPage> {
  let content = input.content ?? EMPTY_DOC;
  let emoji = input.emoji ?? null;
  let title = input.title ?? "";
  if (input.templateId) {
    const template = await getPageById(input.templateId);
    if (!template) throw new NotFoundError("Template");
    content = template.content;
    emoji = emoji ?? template.emoji;
    title = title || template.title.replace(/\s*template$/i, "");
  }
  return must<KbPage>(
    "Page",
    `insert into kb_pages (space_id, parent_id, title, emoji, content, content_text, client_id, project_id, deal_id, is_template,
       sort_order, created_by, updated_by)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,
       coalesce((select max(sort_order) + 1 from kb_pages where space_id = $1 and parent_id is not distinct from $2::uuid), 0), $11, $11)
     returning *`,
    [
      input.spaceId,
      input.parentId ?? null,
      title,
      emoji,
      JSON.stringify(content),
      extractText(content),
      input.clientId ?? null,
      input.projectId ?? null,
      input.dealId ?? null,
      input.isTemplate ?? false,
      createdBy,
    ],
  );
}

export type PagePatch = {
  title?: string;
  emoji?: string | null;
  content?: KbContent;
  spaceId?: string;
  parentId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  dealId?: string | null;
  isTemplate?: boolean;
};

export async function updatePage(id: string, patch: PagePatch, updatedBy: string): Promise<KbPage> {
  return tx(async () => {
    const page = await must<KbPage>("Page", "select * from kb_pages where id = $1 for update", [id]);
    if (patch.parentId) {
      if (patch.parentId === id) throw new ValidationError("A page can't be nested inside itself.");
      const [cycle] = await query(
        `with recursive descendants as (
           select id from kb_pages where parent_id = $1
           union all select p.id from kb_pages p join descendants d on p.parent_id = d.id
         ) select 1 from descendants where id = $2 limit 1`,
        [id, patch.parentId],
      );
      if (cycle) throw new ValidationError("A page can't be moved inside one of its own sub-pages.");
    }
    // Moving to another space detaches from a parent that lives elsewhere.
    let parentId = patch.parentId === undefined ? page.parentId : patch.parentId;
    const spaceId = patch.spaceId ?? page.spaceId;
    if (patch.spaceId && patch.spaceId !== page.spaceId && patch.parentId === undefined) parentId = null;

    const content = patch.content ?? page.content;
    const updated = await must<KbPage>(
      "Page",
      `update kb_pages set title = $2, emoji = $3, content = $4::jsonb, content_text = $5, space_id = $6, parent_id = $7,
         client_id = $8, project_id = $9, deal_id = $10, is_template = $11, updated_by = $12, updated_at = now()
       where id = $1 returning *`,
      [
        id,
        patch.title ?? page.title,
        patch.emoji === undefined ? page.emoji : patch.emoji,
        JSON.stringify(content),
        patch.content ? extractText(content) : page.contentText,
        spaceId,
        parentId,
        patch.clientId === undefined ? page.clientId : patch.clientId,
        patch.projectId === undefined ? page.projectId : patch.projectId,
        patch.dealId === undefined ? page.dealId : patch.dealId,
        patch.isTemplate ?? page.isTemplate,
        updatedBy,
      ],
    );
    // Sub-pages follow their parent to a new space.
    if (spaceId !== page.spaceId) {
      await query(
        `with recursive descendants as (
           select id from kb_pages where parent_id = $1
           union all select p.id from kb_pages p join descendants d on p.parent_id = d.id
         ) update kb_pages set space_id = $2 where id in (select id from descendants)`,
        [id, spaceId],
      );
    }
    return updated;
  });
}

export async function duplicatePage(id: string, userId: string): Promise<KbPage> {
  const page = await getPageById(id);
  if (!page) throw new NotFoundError("Page");
  return createPage(
    {
      spaceId: page.spaceId,
      parentId: page.parentId,
      title: `${page.title || "Untitled"} copy`,
      emoji: page.emoji,
      content: page.content,
      clientId: page.clientId,
      projectId: page.projectId,
      dealId: page.dealId,
      isTemplate: page.isTemplate,
    },
    userId,
  );
}

export async function deletePage(id: string): Promise<void> {
  const rows = await query("delete from kb_pages where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Page");
}

// --- Favorites & recents (per user) ---

export async function isFavorite(userId: string, pageId: string): Promise<boolean> {
  return (await query("select 1 from kb_favorites where user_id = $1 and page_id = $2", [userId, pageId])).length > 0;
}

export async function setFavorite(userId: string, pageId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    await query("insert into kb_favorites (user_id, page_id) values ($1, $2) on conflict do nothing", [userId, pageId]);
  } else {
    await query("delete from kb_favorites where user_id = $1 and page_id = $2", [userId, pageId]);
  }
}

export async function listFavorites(userId: string): Promise<KbPageSummary[]> {
  return many<KbPageSummary>(
    `select ${SUMMARY_COLS}, s.name as space_name from kb_favorites f
     join kb_pages p on p.id = f.page_id join kb_spaces s on s.id = p.space_id
     where f.user_id = $1 order by f.created_at desc`,
    [userId],
  );
}

export async function recordPageView(userId: string, pageId: string): Promise<void> {
  await query(
    "insert into kb_page_views (user_id, page_id) values ($1, $2) on conflict (user_id, page_id) do update set viewed_at = now()",
    [userId, pageId],
  );
}

export async function listRecentPages(userId: string, limit = 8): Promise<KbPageSummary[]> {
  return many<KbPageSummary>(
    `select ${SUMMARY_COLS}, s.name as space_name from kb_page_views v
     join kb_pages p on p.id = v.page_id join kb_spaces s on s.id = p.space_id
     where v.user_id = $1 and not p.is_template order by v.viewed_at desc limit $2`,
    [userId, limit],
  );
}

export async function listRecentlyUpdatedPages(limit = 8): Promise<KbPageSummary[]> {
  return many<KbPageSummary>(
    `select ${SUMMARY_COLS}, s.name as space_name from kb_pages p join kb_spaces s on s.id = p.space_id
     where not p.is_template order by p.updated_at desc limit $1`,
    [limit],
  );
}

/** Full-text search over title + body, with a highlighted-free plain snippet. */
export async function searchPages(term: string, limit = 20): Promise<KbPageSummary[]> {
  const q = term.replace(/[':&|!()\\*<>]/g, " ").trim();
  if (!q) return [];
  return many<KbPageSummary>(
    `select ${SUMMARY_COLS}, s.name as space_name, left(p.content_text, 160) as snippet
     from kb_pages p join kb_spaces s on s.id = p.space_id
     where not p.is_template and (p.search @@ websearch_to_tsquery('simple', $1) or p.title ilike '%' || $1 || '%'
       or p.search @@ to_tsquery('simple', regexp_replace(trim($1), '\\s+', ':* & ', 'g') || ':*'))
     order by ts_rank(p.search, websearch_to_tsquery('simple', $1)) desc, p.updated_at desc
     limit $2`,
    [q, limit],
  );
}
