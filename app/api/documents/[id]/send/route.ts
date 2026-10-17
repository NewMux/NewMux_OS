import { route, body } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { markSent } from "@/lib/data/officialDocs";
import { sendSchema } from "@/lib/validators/document";

/** Records that it went to the client (email, WhatsApp, download) and returns the link to send. */
export const POST = route<{ id: string }>({ allow: canAccessDocuments }, async ({ req, params, session }) => {
  const { via } = await body(req, sendSchema);
  const { sharePath, document } = await markSent(params.id, via, session.user.id);
  return { document, shareUrl: sharePath ? `${req.nextUrl.origin}${sharePath}` : null };
});
