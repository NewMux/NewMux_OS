import { randomUUID } from "crypto";
import { store } from "./store";
import type { PipelineItem } from "./types";

export async function listPipelineItems(): Promise<PipelineItem[]> {
  return store.pipelineItems;
}

export async function createPipelineItem(input: { name: string; notes?: string | null }): Promise<PipelineItem> {
  const item: PipelineItem = { id: randomUUID(), name: input.name, stage: "in_progress", notes: input.notes ?? null };
  store.pipelineItems.push(item);
  return item;
}

export async function togglePipelineStage(id: string): Promise<PipelineItem> {
  const item = store.pipelineItems.find((p) => p.id === id);
  if (!item) throw new Error("Pipeline item not found");
  item.stage = item.stage === "in_progress" ? "complete" : "in_progress";
  return item;
}

export async function listAuditLog() {
  return [...store.auditLog].sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1));
}
