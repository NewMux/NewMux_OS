import { route, body } from "@/lib/api";
import { canAccessSettings } from "@/lib/rbac";
import { upsertProfitSplitRuleSchema } from "@/lib/validators/finance";
import { listProfitSplitRules, upsertProfitSplitRule } from "@/lib/data/finance";

export const GET = route({ allow: canAccessSettings }, async () => ({ rules: await listProfitSplitRules() }));

export const POST = route({ allow: canAccessSettings }, async ({ req, session }) => ({
  rule: await upsertProfitSplitRule({ ...(await body(req, upsertProfitSplitRuleSchema)), updatedBy: session.user.id }),
}));
