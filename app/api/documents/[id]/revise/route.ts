import { route } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { reviseDocument } from "@/lib/data/officialDocs";

/** A new draft version of an issued document (it replaces the original when issued). */
export const POST = route<{ id: string }>({ allow: canAccessDocuments, status: 201 }, async ({ params, session }) => ({
  document: await reviseDocument(params.id, session.user.id),
}));
