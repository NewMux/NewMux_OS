import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { listMeetings } from "@/lib/data/meetings";
import { listProjects } from "@/lib/data/projects";
import { listClients } from "@/lib/data/clients";
import { CalendarScreen } from "./CalendarScreen";

export const metadata = { title: "Calendar" };

export default async function MeetingsPage() {
  const session = (await auth())!;
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [meetings, projects, clients] = await Promise.all([
    listMeetings({ from }),
    listProjects(),
    isPartnerAdmin(session) ? listClients() : Promise.resolve([]),
  ]);
  return (
    <CalendarScreen
      meetings={meetings}
      projects={projects.filter((p) => p.status !== "archived").map((p) => ({ id: p.id, name: p.name }))}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
