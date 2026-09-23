import { query } from "@/lib/db";
import { many } from "./sql";
import type { AuditEntityType, AuditLogAction, AuditLogEntry } from "./types";

export async function logAudit(entry: {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditLogAction;
  summary: string;
  changedBy: string | null;
}): Promise<void> {
  await query(
    "insert into audit_log (entity_type, entity_id, action, summary, changed_by) values ($1, $2, $3, $4, $5)",
    [entry.entityType, entry.entityId, entry.action, entry.summary, entry.changedBy],
  );
}

export async function listAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  return many<AuditLogEntry>(
    `select a.*, u.full_name as changed_by_name from audit_log a
     left join users u on u.id = a.changed_by
     order by a.changed_at desc limit $1`,
    [limit],
  );
}
