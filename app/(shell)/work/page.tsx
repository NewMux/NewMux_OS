import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { listProjectsWithStats, listTasks } from "@/lib/data/projects";
import { listClients } from "@/lib/data/clients";
import { addDaysYmd, todayYmd } from "@/lib/time";
import { WorkScreen } from "./WorkScreen";

export const metadata = { title: "Work" };

export default async function WorkPage() {
  const session = (await auth())!;
  const admin = isPartnerAdmin(session);
  const [projects, mine, clients] = await Promise.all([
    listProjectsWithStats({ includeArchived: true }),
    listTasks({ assigneeId: session.user.id, openOnly: true }),
    admin ? listClients() : Promise.resolve([]),
  ]);
  const today = todayYmd();
  const counts = {
    today: mine.filter((t) => t.dueAt && t.dueAt <= today).length,
    upcoming: mine.filter((t) => t.dueAt && t.dueAt > today && t.dueAt <= addDaysYmd(today, 7)).length,
    overdue: mine.filter((t) => t.dueAt && t.dueAt < today).length,
    all: mine.length,
  };
  return <WorkScreen projects={projects} counts={counts} clients={clients.map((c) => ({ id: c.id, name: c.name }))} canDelete={admin} />;
}
