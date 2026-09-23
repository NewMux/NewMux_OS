import { route } from "@/lib/api";
import { listUsers } from "@/lib/data/users";

/** Active teammates for assignee/owner pickers (no emails or hashes needed beyond name). */
export const GET = route({}, async () => ({ users: (await listUsers()).map((u) => ({ id: u.id, fullName: u.fullName })) }));
