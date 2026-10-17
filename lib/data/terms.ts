import { query, tx } from "@/lib/db";
import { many, must, one, ValidationError } from "./sql";
import { logAudit } from "./audit";
import type { TermsTemplate, TermsTemplateClause } from "./types";

/**
 * The Terms & Conditions library (PRD addendum 1.2, section 6): a template
 * per product type (ERP System, SaaS, Website, Other, and any added in
 * Settings), each an ordered list of clauses, plus standalone clauses that
 * can go into any document or letter.
 *
 * Saving a template that changed bumps its version and keeps the text of
 * every version (terms_template_versions). Documents copy the clauses they
 * use, so editing a template never changes a document, and editing a
 * document's clauses never changes the template.
 */

export type ClauseInput = { title: string; body: string; defaultOn: boolean };

export async function listTermsTemplates(opts: { activeOnly?: boolean } = {}): Promise<TermsTemplate[]> {
  const [templates, clauses] = await Promise.all([
    many<Omit<TermsTemplate, "clauses">>(`select * from terms_templates ${opts.activeOnly ? "where is_active" : ""} order by sort_order, name`),
    many<TermsTemplateClause>("select * from terms_clauses where template_id is not null order by sort_order"),
  ]);
  return templates.map((t) => ({ ...t, clauses: clauses.filter((c) => c.templateId === t.id) }));
}

export async function getTermsTemplate(id: string): Promise<TermsTemplate | undefined> {
  const t = await one<Omit<TermsTemplate, "clauses">>("select * from terms_templates where id = $1", [id]);
  if (!t) return undefined;
  return { ...t, clauses: await many<TermsTemplateClause>("select * from terms_clauses where template_id = $1 order by sort_order", [id]) };
}

export async function listStandaloneClauses(): Promise<TermsTemplateClause[]> {
  return many<TermsTemplateClause>("select * from terms_clauses where template_id is null order by sort_order");
}

export async function listTemplateVersions(templateId: string): Promise<{ version: number; name: string; clauses: ClauseInput[]; savedAt: string; savedByName: string | null }[]> {
  return many(
    `select v.version, v.name, v.clauses, v.saved_at, u.full_name as saved_by_name from terms_template_versions v
     left join users u on u.id = v.saved_by where v.template_id = $1 order by v.version desc`,
    [templateId],
  );
}

const same = (a: ClauseInput[], b: ClauseInput[]) =>
  a.length === b.length && a.every((c, i) => c.title === b[i]!.title && c.body === b[i]!.body && c.defaultOn === b[i]!.defaultOn);

async function writeClauses(templateId: string | null, clauses: ClauseInput[]) {
  await query(templateId ? "delete from terms_clauses where template_id = $1" : "delete from terms_clauses where template_id is null", templateId ? [templateId] : []);
  for (const [i, c] of clauses.entries()) {
    await query("insert into terms_clauses (template_id, title, body, default_on, sort_order) values ($1, $2, $3, $4, $5)", [templateId, c.title, c.body, c.defaultOn, i]);
  }
}

async function snapshot(templateId: string, version: number, name: string, clauses: ClauseInput[], by: string) {
  await query("insert into terms_template_versions (template_id, version, name, clauses, saved_by) values ($1, $2, $3, $4::jsonb, $5)", [
    templateId,
    version,
    name,
    JSON.stringify(clauses),
    by,
  ]);
}

/** Creates a template, or saves one: a change to its name or clauses makes a new version. */
export async function saveTermsTemplate(id: string | null, input: { name: string; isActive: boolean; clauses: ClauseInput[] }, by: string): Promise<TermsTemplate> {
  const clash = await one<{ id: string }>("select id from terms_templates where lower(name) = lower($1) and id <> coalesce($2::uuid, '00000000-0000-0000-0000-000000000000')", [input.name, id]);
  if (clash) throw new ValidationError(`There's already a template called ${input.name}.`);
  return tx(async () => {
    if (!id) {
      const t = await must<{ id: string }>(
        "Template",
        "insert into terms_templates (name, is_active, sort_order) values ($1, $2, coalesce((select max(sort_order) + 1 from terms_templates), 0)) returning id",
        [input.name, input.isActive],
      );
      await writeClauses(t.id, input.clauses);
      await snapshot(t.id, 1, input.name, input.clauses, by);
      await logAudit({ entityType: "terms_template", entityId: t.id, action: "create", summary: `Added terms template ${input.name}`, changedBy: by });
      return (await getTermsTemplate(t.id))!;
    }
    const before = await getTermsTemplate(id);
    if (!before) throw new ValidationError("That template no longer exists.");
    const old = before.clauses.map((c) => ({ title: c.title, body: c.body, defaultOn: c.defaultOn }));
    const changed = before.name !== input.name || !same(old, input.clauses);
    const version = changed ? before.version + 1 : before.version;
    await query("update terms_templates set name = $2, is_active = $3, version = $4, updated_at = now() where id = $1", [id, input.name, input.isActive, version]);
    if (changed) {
      await writeClauses(id, input.clauses);
      await snapshot(id, version, input.name, input.clauses, by);
    }
    await logAudit({
      entityType: "terms_template",
      entityId: id,
      action: "update",
      summary: changed ? `Saved terms template ${input.name} as version ${version}` : `${input.isActive ? "Showed" : "Hid"} terms template ${input.name}`,
      changedBy: by,
    });
    return (await getTermsTemplate(id))!;
  });
}

export async function saveStandaloneClauses(clauses: ClauseInput[], by: string): Promise<TermsTemplateClause[]> {
  await tx(() => writeClauses(null, clauses));
  // No template row to point at: the audit log keys these on the person who saved them.
  await logAudit({ entityType: "terms_template", entityId: by, action: "update", summary: `Saved ${clauses.length} standalone clauses`, changedBy: by });
  return listStandaloneClauses();
}
