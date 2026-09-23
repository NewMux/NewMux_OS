import { query } from "@/lib/db";
import { many, must, NotFoundError } from "./sql";
import type { PipelineItem } from "./types";

export { listAuditLog } from "./audit";

export async function listPipelineItems(): Promise<PipelineItem[]> {
  return many<PipelineItem>("select id, name, stage, notes from pipeline_items order by stage, created_at");
}

export async function createPipelineItem(input: { name: string; notes?: string | null }): Promise<PipelineItem> {
  return must<PipelineItem>("Pipeline item", "insert into pipeline_items (name, notes) values ($1, $2) returning id, name, stage, notes", [
    input.name,
    input.notes ?? null,
  ]);
}

export async function togglePipelineStage(id: string): Promise<PipelineItem> {
  return must<PipelineItem>(
    "Pipeline item",
    "update pipeline_items set stage = case when stage = 'in_progress' then 'complete' else 'in_progress' end where id = $1 returning id, name, stage, notes",
    [id],
  );
}

export async function deletePipelineItem(id: string): Promise<void> {
  const rows = await query("delete from pipeline_items where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Pipeline item");
}
