import { route, body } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { transitionSchema } from "@/lib/validators/document";
import { transitionDocumentStatus } from "@/lib/data/documents";

export const POST = route<{ id: string }>({ allow: canAccessDocuments }, async ({ req, params, session }) => ({
  document: await transitionDocumentStatus(params.id, (await body(req, transitionSchema)).to, session.user.id),
}));
