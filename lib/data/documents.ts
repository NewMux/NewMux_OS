import { randomUUID } from "crypto";
import { store } from "./store";
import type { DocumentRecord, DocumentLineItem, DocumentStatus, DocumentType } from "./types";
import { subtotalCents as calcSubtotal, taxCents as calcTax, totalCents as calcTotal } from "@/lib/money";

const SEQUENCES: Record<DocumentType, { prefix: string; counter: number }> = {
  quote: { prefix: "QUO", counter: 100 },
  contract: { prefix: "CON", counter: 100 },
  invoice: { prefix: "INV", counter: 100 },
};

// Seed data already used QUO-2026-0004 / CON-2025-0012 / INV-2026-0001 —
// bump counters so newly created documents don't collide.
SEQUENCES.quote.counter = 4;
SEQUENCES.contract.counter = 12;
SEQUENCES.invoice.counter = 1;

function nextDocumentNumber(type: DocumentType): string {
  const seq = SEQUENCES[type];
  seq.counter += 1;
  const year = new Date().getFullYear();
  return `${seq.prefix}-${year}-${String(seq.counter).padStart(4, "0")}`;
}

export async function listDocuments(filter?: { type?: DocumentType }): Promise<DocumentRecord[]> {
  return store.documents
    .filter((d) => !filter?.type || d.type === filter.type)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getDocumentById(id: string): Promise<DocumentRecord | undefined> {
  return store.documents.find((d) => d.id === id);
}

export async function getLineItems(documentId: string): Promise<DocumentLineItem[]> {
  return store.documentLineItems
    .filter((li) => li.documentId === documentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getClientById(clientId: string) {
  return store.clients.find((c) => c.id === clientId);
}

export async function createDocument(input: {
  type: DocumentType;
  clientId: string;
  productId?: string | null;
  taxRateBps: number;
  paymentTerms?: string;
  notes?: string;
  lineItems: { description: string; quantity: number; unitPriceCents: number }[];
  createdBy: string;
}): Promise<DocumentRecord> {
  const subtotal = calcSubtotal(input.lineItems);
  const tax = calcTax(subtotal, input.taxRateBps);
  const now = new Date().toISOString();

  const doc: DocumentRecord = {
    id: randomUUID(),
    type: input.type,
    status: "draft",
    clientId: input.clientId,
    productId: input.productId ?? null,
    documentNumber: nextDocumentNumber(input.type),
    currency: "USD",
    subtotalCents: subtotal,
    taxRateBps: input.taxRateBps,
    taxCents: tax,
    totalCents: calcTotal(subtotal, tax),
    paymentTerms: input.paymentTerms ?? null,
    notes: input.notes ?? null,
    issuedAt: null,
    dueAt: null,
    acceptedAt: null,
    paidAt: null,
    archivedAt: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  store.documents.push(doc);

  input.lineItems.forEach((li, i) => {
    store.documentLineItems.push({
      id: randomUUID(),
      documentId: doc.id,
      description: li.description,
      quantity: li.quantity,
      unitPriceCents: li.unitPriceCents,
      sortOrder: i,
    });
  });

  store.documentStatusHistory.push({
    id: randomUUID(),
    documentId: doc.id,
    fromStatus: null,
    toStatus: "draft",
    changedBy: input.createdBy,
    changedAt: now,
  });

  return doc;
}

export async function updateDocumentLineItems(
  documentId: string,
  lineItems: { description: string; quantity: number; unitPriceCents: number }[],
): Promise<DocumentRecord> {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) throw new Error("Document not found");

  store.documentLineItems = store.documentLineItems.filter((li) => li.documentId !== documentId);
  lineItems.forEach((li, i) => {
    store.documentLineItems.push({
      id: randomUUID(),
      documentId,
      description: li.description,
      quantity: li.quantity,
      unitPriceCents: li.unitPriceCents,
      sortOrder: i,
    });
  });

  const subtotal = calcSubtotal(lineItems);
  const tax = calcTax(subtotal, doc.taxRateBps);
  doc.subtotalCents = subtotal;
  doc.taxCents = tax;
  doc.totalCents = calcTotal(subtotal, tax);
  doc.updatedAt = new Date().toISOString();
  return doc;
}

export async function transitionDocumentStatus(
  documentId: string,
  to: DocumentStatus,
  changedBy: string,
): Promise<DocumentRecord> {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) throw new Error("Document not found");

  const now = new Date().toISOString();
  const from = doc.status;
  doc.status = to;
  doc.updatedAt = now;
  if (to === "sent" && !doc.issuedAt) doc.issuedAt = now;
  if (to === "accepted") doc.acceptedAt = now;
  if (to === "paid") doc.paidAt = now;
  if (to === "archived") doc.archivedAt = now;

  store.documentStatusHistory.push({
    id: randomUUID(),
    documentId,
    fromStatus: from,
    toStatus: to,
    changedBy,
    changedAt: now,
  });

  return doc;
}

export async function getStatusHistory(documentId: string) {
  return store.documentStatusHistory
    .filter((h) => h.documentId === documentId)
    .sort((a, b) => (a.changedAt < b.changedAt ? -1 : 1));
}

export async function listClients() {
  return store.clients;
}

export async function listProducts() {
  return store.products;
}

/**
 * NFR: RESTRICT deleting a client linked to active (non-archived) invoices.
 * DB layer will additionally enforce this via FK `on delete restrict`.
 */
export async function assertClientDeletable(clientId: string) {
  const activeDocs = store.documents.filter((d) => d.clientId === clientId && d.status !== "archived");
  if (activeDocs.length > 0) {
    throw new Error(
      `Cannot delete client: ${activeDocs.length} non-archived document(s) reference it (${activeDocs
        .map((d) => d.documentNumber)
        .join(", ")}).`,
    );
  }
}
