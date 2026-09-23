import { route, body } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { updateDocumentSchema } from "@/lib/validators/document";
import { deleteDocument, getDocumentById, getLineItems, updateDocument } from "@/lib/data/documents";
import { NotFoundError } from "@/lib/data/sql";

type P = { id: string };

export const GET = route<P>({ allow: canAccessDocuments }, async ({ params }) => {
  const document = await getDocumentById(params.id);
  if (!document) throw new NotFoundError("Document");
  return { document, lineItems: await getLineItems(params.id) };
});

export const PATCH = route<P>({ allow: canAccessDocuments }, async ({ req, params, session }) => ({
  document: await updateDocument(params.id, await body(req, updateDocumentSchema), session.user.id),
}));

export const DELETE = route<P>({ allow: canAccessDocuments }, async ({ params, session }) => {
  await deleteDocument(params.id, session.user.id);
  return { ok: true };
});
