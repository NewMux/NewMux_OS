import { route, body } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { createDocumentSchema } from "@/lib/validators/document";
import { createDocument, listDocuments } from "@/lib/data/documents";
import type { DocumentType } from "@/lib/data/types";

export const GET = route({ allow: canAccessDocuments }, async ({ req }) => ({
  documents: await listDocuments({ type: (req.nextUrl.searchParams.get("type") as DocumentType | null) ?? undefined }),
}));

export const POST = route({ allow: canAccessDocuments, status: 201 }, async ({ req, session }) => ({
  document: await createDocument({ ...(await body(req, createDocumentSchema)), createdBy: session.user.id }),
}));
