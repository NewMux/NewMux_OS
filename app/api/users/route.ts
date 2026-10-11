import bcrypt from "bcryptjs";
import { route, body } from "@/lib/api";
import { createUser, listUsers } from "@/lib/data/users";
import { logAudit } from "@/lib/data/audit";
import { one, ValidationError } from "@/lib/data/sql";
import { isPartnerAdmin } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/data/types";
import { createUserSchema } from "@/lib/validators/users";

/** Active teammates for assignee/owner pickers (no emails or hashes needed beyond name). */
export const GET = route({}, async () => ({ users: (await listUsers()).map((u) => ({ id: u.id, fullName: u.fullName })) }));

/** Settings → Team: a partner adds someone with a role and a first password (they change it under Settings → Account). */
export const POST = route({ allow: isPartnerAdmin, status: 201 }, async ({ req, session }) => {
  const input = await body(req, createUserSchema);
  // An inactive account still holds its email, so check every account, not just active ones.
  if (await one("select 1 from users where lower(email) = lower($1)", [input.email])) {
    throw new ValidationError("Someone already has an account with that email. Find them in the list to change their role or reactivate them.");
  }
  const user = await createUser({ email: input.email, fullName: input.fullName, role: input.role, passwordHash: await bcrypt.hash(input.password, 12) });
  await logAudit({ entityType: "user", entityId: user.id, action: "create", summary: `Added ${user.fullName} (${user.email}) as ${ROLE_LABEL[user.role]}`, changedBy: session.user.id });
  return { user };
});
