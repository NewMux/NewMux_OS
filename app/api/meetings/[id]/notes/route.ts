import { route } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { getMeetingById, setMeetingNotesPage } from "@/lib/data/meetings";
import { createPage, listSpaces, listTemplates } from "@/lib/data/kb";
import { NotFoundError, ValidationError } from "@/lib/data/sql";
import { formatDate } from "@/lib/time";

/** Creates (or returns) a wiki page of meeting notes, from the Meeting Notes template. */
export const POST = route<{ id: string }>({ allow: canAccessWork }, async ({ params, session }) => {
  const meeting = await getMeetingById(params.id);
  if (!meeting) throw new NotFoundError("Meeting");
  if (meeting.kbPageId) return { pageId: meeting.kbPageId };
  const [spaces, templates] = await Promise.all([listSpaces(), listTemplates()]);
  const space = spaces.find((s) => s.name === "Clients" && meeting.linkedClientId) ?? spaces[0];
  if (!space) throw new ValidationError("Create a wiki space first.");
  const template = templates.find((t) => /meeting/i.test(t.title));
  const page = await createPage(
    {
      spaceId: space.id,
      title: `${meeting.title} — ${formatDate(meeting.startsAt)}`,
      emoji: "📝",
      templateId: template?.id ?? null,
      clientId: meeting.linkedClientId,
      projectId: meeting.linkedProjectId,
      dealId: meeting.linkedDealId,
    },
    session.user.id,
  );
  await setMeetingNotesPage(meeting.id, page.id);
  return { pageId: page.id };
});
