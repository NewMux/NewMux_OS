import { route, body } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { finishIssue, startIssue } from "@/lib/data/officialDocs";
import { issueFinishSchema, issueStartSchema } from "@/lib/validators/document";
import { ValidationError } from "@/lib/data/sql";

type P = { id: string };

/**
 * Signing and issuing, in two steps (lib/data/officialDocs.ts).
 * POST: the signatory's password → the number, and the document as it will
 * print. PUT: the PDF the browser made with the drawn signature → issued.
 */
export const POST = route<P>({ allow: canAccessDocuments }, async ({ req, params, session }) => {
  const input = await body(req, issueStartSchema);
  return startIssue(params.id, { id: session.user.id }, { sign: input.sign, password: input.password });
});

export const PUT = route<P>({ allow: canAccessDocuments }, async ({ req, params, session }) => {
  const { token, pdf } = await body(req, issueFinishSchema);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
  } catch {
    throw new ValidationError("The PDF didn't arrive intact. Try again.");
  }
  return { document: await finishIssue(params.id, { id: session.user.id }, token, bytes) };
});
