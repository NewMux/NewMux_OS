import { query, tx } from "@/lib/db";
import { many, must, one, NotFoundError, ValidationError } from "./sql";
import { logAudit } from "./audit";
import { daysUntil, todayYmd } from "@/lib/time";

/**
 * Company files (Improvements PRD item 18): contracts, the Commercial
 * Registration, brand identity, certificates — with issue and expiry dates
 * and a reminder window. Also receipt photos for expenses (item 38).
 * Bytes live in file_blobs so lists never load them.
 */

export const FILE_CATEGORIES = ["contract", "registration", "certificate", "brand", "legal", "finance", "receipt", "other"] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export type StoredFile = {
  id: string;
  name: string;
  category: FileCategory;
  contentType: string;
  sizeBytes: number;
  issueDate: string | null;
  expiryDate: string | null;
  remindDaysBefore: number;
  notes: string | null;
  clientId: string | null;
  projectId: string | null;
  ventureId: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FileListItem = StoredFile & { clientName: string | null; projectName: string | null; ventureName: string | null; uploadedByName: string | null };

export async function listFiles(filter: { includeReceipts?: boolean; clientId?: string; projectId?: string; ventureId?: string } = {}): Promise<FileListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!filter.includeReceipts) where.push("f.category <> 'receipt'");
  if (filter.clientId) where.push(`f.client_id = $${params.push(filter.clientId)}`);
  if (filter.projectId) where.push(`f.project_id = $${params.push(filter.projectId)}`);
  if (filter.ventureId) where.push(`f.venture_id = $${params.push(filter.ventureId)}`);
  return many<FileListItem>(
    `select f.*, c.name as client_name, p.name as project_name, v.name as venture_name, u.full_name as uploaded_by_name
     from files f
     left join clients c on c.id = f.client_id
     left join projects p on p.id = f.project_id
     left join ventures v on v.id = f.venture_id
     left join users u on u.id = f.uploaded_by
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by f.expiry_date nulls last, f.created_at desc`,
    params,
  );
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  return one<StoredFile>("select * from files where id = $1", [id]);
}

export async function getFileBytes(id: string): Promise<{ file: StoredFile; data: Buffer } | undefined> {
  const file = await getFile(id);
  if (!file) return undefined;
  const blob = await one<{ data: Uint8Array }>("select data from file_blobs where file_id = $1", [id]);
  if (!blob) return undefined;
  return { file, data: Buffer.from(blob.data) };
}

export type FileMeta = {
  name: string;
  category: FileCategory;
  issueDate?: string | null;
  expiryDate?: string | null;
  remindDaysBefore?: number;
  notes?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  ventureId?: string | null;
};

export async function createFile(meta: FileMeta, upload: { contentType: string; data: Buffer }, by: string): Promise<StoredFile> {
  if (upload.data.byteLength === 0) throw new ValidationError("The file is empty.");
  if (upload.data.byteLength > MAX_FILE_BYTES) throw new ValidationError("Files can be up to 15 MB.");
  return tx(async () => {
    const file = await must<StoredFile>(
      "File",
      `insert into files (name, category, content_type, size_bytes, issue_date, expiry_date, remind_days_before, notes, client_id, project_id, venture_id, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
      [
        meta.name,
        meta.category,
        upload.contentType || "application/octet-stream",
        upload.data.byteLength,
        meta.issueDate ?? null,
        meta.expiryDate ?? null,
        meta.remindDaysBefore ?? 30,
        meta.notes ?? null,
        meta.clientId ?? null,
        meta.projectId ?? null,
        meta.ventureId ?? null,
        by,
      ],
    );
    await query("insert into file_blobs (file_id, data) values ($1, $2)", [file.id, upload.data]);
    if (file.category !== "receipt") {
      await logAudit({ entityType: "file", entityId: file.id, action: "create", summary: `Uploaded "${file.name}"`, changedBy: by });
    }
    return file;
  });
}

export async function updateFile(id: string, meta: FileMeta, by: string): Promise<StoredFile> {
  const file = await must<StoredFile>(
    "File",
    `update files set name = $2, category = $3, issue_date = $4, expiry_date = $5, remind_days_before = $6, notes = $7,
       client_id = $8, project_id = $9, venture_id = $10, updated_at = now()
     where id = $1 returning *`,
    [
      id,
      meta.name,
      meta.category,
      meta.issueDate ?? null,
      meta.expiryDate ?? null,
      meta.remindDaysBefore ?? 30,
      meta.notes ?? null,
      meta.clientId ?? null,
      meta.projectId ?? null,
      meta.ventureId ?? null,
    ],
  );
  await logAudit({ entityType: "file", entityId: id, action: "update", summary: `Edited "${file.name}"`, changedBy: by });
  return file;
}

export async function deleteFile(id: string, by: string): Promise<void> {
  const rows = await query<{ name: string }>("delete from files where id = $1 returning name", [id]);
  if (!rows.length) throw new NotFoundError("File");
  await logAudit({ entityType: "file", entityId: id, action: "delete", summary: `Deleted "${rows[0]!.name}"`, changedBy: by });
}

export type ExpiringFile = { id: string; name: string; category: FileCategory; expiryDate: string; daysLeft: number };

/** Files inside their reminder window (or already expired), soonest first. */
export async function listExpiringFiles(): Promise<ExpiringFile[]> {
  const rows = await many<{ id: string; name: string; category: FileCategory; expiryDate: string; remindDaysBefore: number }>(
    "select id, name, category, expiry_date, remind_days_before from files where expiry_date is not null and category <> 'receipt' and expiry_date <= $1::date + remind_days_before",
    [todayYmd()],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, category: r.category, expiryDate: r.expiryDate, daysLeft: daysUntil(r.expiryDate) })).sort((a, b) => a.daysLeft - b.daysLeft);
}
