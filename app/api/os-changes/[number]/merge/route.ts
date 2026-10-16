import { route } from "@/lib/api";
import { isPartnerAdmin } from "@/lib/rbac";
import { mergeOsChange } from "@/lib/osChanges";
import { osChangeNumber } from "@/lib/validators/osChanges";

/** Merges a request's pull request, which puts it live. Partners only, and only once its checks pass. */
export const POST = route<{ number: string }>({ allow: isPartnerAdmin }, async ({ params, session }) => ({
  change: await mergeOsChange(osChangeNumber(params.number), { id: session.user.id, name: session.user.name ?? "A partner", role: session.user.role }),
}));
