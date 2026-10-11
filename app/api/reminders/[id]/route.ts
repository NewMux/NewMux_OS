import { route } from "@/lib/api";
import { deleteReminder, getReminder } from "@/lib/data/notifications";
import { NotFoundError } from "@/lib/data/sql";
import { ForbiddenError } from "@/lib/rbac";

/** Cancel a reminder you set or that's for you. */
export const DELETE = route<{ id: string }>({}, async ({ params, session }) => {
  const reminder = await getReminder(params.id);
  if (!reminder) throw new NotFoundError("Reminder");
  if (reminder.userId !== session.user.id && reminder.createdBy !== session.user.id) throw new ForbiddenError();
  await deleteReminder(params.id);
  return { ok: true };
});
