import { query } from "@/lib/db";
import { many, must, one, ValidationError } from "./sql";
import { logAudit } from "./audit";
import type { DocumentType, Signatory } from "./types";

/**
 * Who signs official documents for NewMux (PRD addendum 1.2, section 4).
 * Name and position are separate and editable; a document keeps a snapshot
 * of both from the moment it's issued. Deactivating hides someone from the
 * pickers but never deletes them, so old documents stay intact.
 */

type Row = Omit<Signatory, "defaultFor"> & { defaultFor: string };

const toSignatory = (r: Row): Signatory => ({ ...r, defaultFor: r.defaultFor ? (r.defaultFor.split(",").filter(Boolean) as DocumentType[]) : [] });

export async function listSignatories(opts: { activeOnly?: boolean } = {}): Promise<Signatory[]> {
  const rows = await many<Row>(
    `select s.*, u.full_name as user_name from signatories s join users u on u.id = s.user_id
     ${opts.activeOnly ? "where s.is_active" : ""} order by s.is_active desc, s.sort_order, s.full_name`,
  );
  return rows.map(toSignatory);
}

export async function getSignatory(id: string): Promise<Signatory | undefined> {
  const row = await one<Row>("select s.*, u.full_name as user_name from signatories s join users u on u.id = s.user_id where s.id = $1", [id]);
  return row ? toSignatory(row) : undefined;
}

/** The default signatory for a type: the first active one marked for it, else the first active one. */
export async function defaultSignatoryFor(type: DocumentType): Promise<Signatory | undefined> {
  const active = await listSignatories({ activeOnly: true });
  return active.find((s) => s.defaultFor.includes(type)) ?? active[0];
}

export type SignatoryInput = { fullName: string; position: string; userId: string; isActive: boolean; defaultFor: DocumentType[] };

async function assertUser(userId: string) {
  const user = await one<{ isActive: boolean }>("select is_active from users where id = $1", [userId]);
  if (!user) throw new ValidationError("Choose the person's login.");
  if (!user.isActive) throw new ValidationError("That login is turned off. Choose an active one.");
}

export async function createSignatory(input: SignatoryInput, by: string): Promise<Signatory> {
  await assertUser(input.userId);
  const row = await must<{ id: string }>(
    "Signatory",
    `insert into signatories (full_name, position, user_id, is_active, default_for, sort_order)
     values ($1, $2, $3, $4, $5, coalesce((select max(sort_order) + 1 from signatories), 0)) returning id`,
    [input.fullName, input.position, input.userId, input.isActive, input.defaultFor.join(",")],
  );
  await logAudit({ entityType: "signatory", entityId: row.id, action: "create", summary: `Added signatory ${input.fullName}, ${input.position}`, changedBy: by });
  return (await getSignatory(row.id))!;
}

export async function updateSignatory(id: string, input: SignatoryInput, by: string): Promise<Signatory> {
  const before = await getSignatory(id);
  if (!before) throw new ValidationError("That signatory no longer exists.");
  await assertUser(input.userId);
  await query(
    "update signatories set full_name = $2, position = $3, user_id = $4, is_active = $5, default_for = $6, updated_at = now() where id = $1",
    [id, input.fullName, input.position, input.userId, input.isActive, input.defaultFor.join(",")],
  );
  const changes = [
    before.fullName !== input.fullName && `name ${before.fullName} → ${input.fullName}`,
    before.position !== input.position && `position ${before.position} → ${input.position}`,
    before.userId !== input.userId && "linked login changed",
    before.isActive !== input.isActive && (input.isActive ? "reactivated" : "deactivated"),
    before.defaultFor.join(",") !== input.defaultFor.join(",") && "default document types changed",
  ].filter(Boolean);
  await logAudit({ entityType: "signatory", entityId: id, action: "update", summary: `Signatory ${input.fullName}: ${changes.join(", ") || "saved"}`, changedBy: by });
  return (await getSignatory(id))!;
}
