import { docStatusLabel } from "@/lib/labels";
import { todayYmd } from "@/lib/time";
import type { SysColor } from "@/lib/colors";
import type { DocumentListItem } from "@/lib/data/documents";

/** What a document's badge should say in lists: Overdue and Partly paid are derived from payments. */
export const outstanding = (d: DocumentListItem) => (d.type === "invoice" && d.status === "sent" ? Math.max(d.totalCents - d.creditedCents - d.paidCents, 0) : 0);
export const isOverdue = (d: DocumentListItem) => outstanding(d) > 0 && !!d.dueAt && d.dueAt < todayYmd();
export const isClosed = (d: DocumentListItem) =>
  ["paid", "archived", "void", "declined"].includes(d.status) || (d.type === "invoice" && d.status === "sent" && outstanding(d) === 0) || (d.type === "credit_note" && d.status === "sent");

export function docBadge(d: DocumentListItem): { label: string; color: SysColor } {
  if (d.status === "void") return { label: "Void", color: "gray" };
  if (isOverdue(d)) return { label: "Overdue", color: "red" };
  if (d.type === "invoice" && d.status === "sent" && d.paidCents > 0 && outstanding(d) > 0) return { label: "Partly paid", color: "orange" };
  if (d.type === "invoice" && d.status === "sent" && outstanding(d) === 0) return { label: "Paid", color: "green" };
  const colors: Record<string, SysColor> = { draft: "gray", sent: "blue", accepted: "indigo", declined: "red", signed: "purple", paid: "green", archived: "gray" };
  return { label: docStatusLabel(d.type, d.status), color: colors[d.status] ?? "gray" };
}
