import { query, tx } from "@/lib/db";
import { many, one, must, buildUpdate, NotFoundError } from "./sql";
import { assertNoFinancialRecords } from "./guards";
import type { Project, ProjectStatus, Subtask, Task, TaskComment, TaskPriority, TaskStatus, TaskWithMeta } from "./types";

// --- Projects ---

export type ProjectWithStats = Project & {
  clientName: string | null;
  taskCount: number;
  doneCount: number;
  openCount: number;
  overdueCount: number;
};

const PROJECT_STATS = `
  select p.*, c.name as client_name,
    (select count(*)::int from tasks t where t.project_id = p.id) as task_count,
    (select count(*)::int from tasks t where t.project_id = p.id and t.status = 'done') as done_count,
    (select count(*)::int from tasks t where t.project_id = p.id and t.status <> 'done') as open_count,
    (select count(*)::int from tasks t where t.project_id = p.id and t.status <> 'done'
       and t.due_at < (now() at time zone 'Asia/Bahrain')::date) as overdue_count
  from projects p left join clients c on c.id = p.client_id`;

export async function listProjects(): Promise<Project[]> {
  return many<Project>("select * from projects order by name");
}

export async function listProjectsWithStats(filter: { clientId?: string; includeArchived?: boolean } = {}): Promise<ProjectWithStats[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.clientId) where.push(`p.client_id = $${params.push(filter.clientId)}`);
  if (!filter.includeArchived) where.push("p.status <> 'archived'");
  return many<ProjectWithStats>(
    `${PROJECT_STATS} ${where.length ? `where ${where.join(" and ")}` : ""}
     order by case p.status when 'active_sprint' then 0 when 'planning' then 1 when 'paused' then 2 when 'completed' then 3 else 4 end, p.name`,
    params,
  );
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return one<Project>("select * from projects where id = $1", [id]);
}

export type ProjectInput = {
  name: string;
  clientId?: string | null;
  description?: string | null;
  color?: string;
  status?: ProjectStatus;
  startedAt?: string | null;
  targetEndAt?: string | null;
  techStack?: string | null;
  hostingProvider?: string | null;
  controlPanelUrl?: string | null;
  domain?: string | null;
  domainRenewalDate?: string | null;
  githubUrl?: string | null;
};

const PROJECT_FIELDS = [
  "name",
  "clientId",
  "description",
  "color",
  "status",
  "startedAt",
  "targetEndAt",
  "techStack",
  "hostingProvider",
  "controlPanelUrl",
  "domain",
  "domainRenewalDate",
  "githubUrl",
] as const;

export async function createProject(input: ProjectInput, createdBy: string): Promise<Project> {
  return must<Project>(
    "Project",
    `insert into projects (name, client_id, description, color, status, started_at, target_end_at, tech_stack,
       hosting_provider, control_panel_url, domain, domain_renewal_date, github_url, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
    [
      input.name,
      input.clientId ?? null,
      input.description ?? null,
      input.color ?? "blue",
      input.status ?? "planning",
      input.startedAt ?? null,
      input.targetEndAt ?? null,
      input.techStack ?? null,
      input.hostingProvider ?? null,
      input.controlPanelUrl ?? null,
      input.domain ?? null,
      input.domainRenewalDate ?? null,
      input.githubUrl ?? null,
      createdBy,
    ],
  );
}

export async function updateProject(id: string, patch: Partial<ProjectInput>): Promise<Project> {
  const { set, values } = buildUpdate(patch, PROJECT_FIELDS, 2);
  if (!set) return must<Project>("Project", "select * from projects where id = $1", [id]);
  return must<Project>("Project", `update projects set ${set}, updated_at = now() where id = $1 returning *`, [id, ...values]);
}

/** Blocked while invoices, payments, expenses or hosting fees refer to it (item 20). */
export async function deleteProject(id: string): Promise<void> {
  await assertNoFinancialRecords("project", id);
  const rows = await query("delete from projects where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Project");
}

export async function countActiveDeliveryProjects(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from projects where status = 'active_sprint'");
  return row?.n ?? 0;
}

// --- Tasks ---

const TASK_META = `
  select t.*, p.name as project_name, p.color as project_color, u.full_name as assignee_name,
    (select count(*)::int from subtasks s where s.task_id = t.id) as subtask_count,
    (select count(*)::int from subtasks s where s.task_id = t.id and s.done) as subtask_done_count,
    (select count(*)::int from task_comments c where c.task_id = t.id) as comment_count
  from tasks t join projects p on p.id = t.project_id left join users u on u.id = t.assignee_id`;

export async function listTasks(filter: { assigneeId?: string; openOnly?: boolean } = {}): Promise<TaskWithMeta[]> {
  const where: string[] = ["p.status <> 'archived'"];
  const params: unknown[] = [];
  if (filter.assigneeId) where.push(`t.assignee_id = $${params.push(filter.assigneeId)}`);
  if (filter.openOnly) where.push("t.status <> 'done'");
  return many<TaskWithMeta>(`${TASK_META} where ${where.join(" and ")} order by t.due_at nulls last, t.sort_order`, params);
}

export async function listTasksByProject(projectId: string): Promise<TaskWithMeta[]> {
  return many<TaskWithMeta>(`${TASK_META} where t.project_id = $1 order by t.sort_order, t.created_at`, [projectId]);
}

export async function getTaskById(id: string): Promise<TaskWithMeta | undefined> {
  return one<TaskWithMeta>(`${TASK_META} where t.id = $1`, [id]);
}

export async function createTask(input: {
  projectId: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status?: TaskStatus;
  assigneeId?: string | null;
  dueAt?: string | null;
  createdBy: string;
}): Promise<Task> {
  return must<Task>(
    "Task",
    `insert into tasks (project_id, title, description, priority, status, assignee_id, due_at, sort_order, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,
       coalesce((select max(sort_order) + 1 from tasks where project_id = $1), 0), $8) returning *`,
    [
      input.projectId,
      input.title,
      input.description ?? null,
      input.priority,
      input.status ?? "todo",
      input.assigneeId ?? null,
      input.dueAt ?? null,
      input.createdBy,
    ],
  );
}

const TASK_FIELDS = ["title", "description", "priority", "status", "assigneeId", "dueAt", "sortOrder", "projectId"] as const;

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "description" | "priority" | "status" | "assigneeId" | "dueAt" | "sortOrder" | "projectId">>,
): Promise<Task> {
  const { set, values } = buildUpdate(patch, TASK_FIELDS, 2);
  if (!set) return must<Task>("Task", "select * from tasks where id = $1", [id]);
  const completedClause =
    patch.status === undefined
      ? ""
      : patch.status === "done"
        ? ", completed_at = coalesce(completed_at, now())"
        : ", completed_at = null";
  return must<Task>("Task", `update tasks set ${set}${completedClause}, updated_at = now() where id = $1 returning *`, [id, ...values]);
}

/** Kept for existing callers. */
export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  return updateTask(taskId, { status });
}

export async function updateTaskPriority(taskId: string, priority: TaskPriority): Promise<Task> {
  return updateTask(taskId, { priority });
}

/** Moves a task to a column and position (board drag & drop). */
export async function moveTask(taskId: string, status: TaskStatus, orderedIds: string[]): Promise<void> {
  await tx(async () => {
    await updateTask(taskId, { status });
    for (const [i, id] of orderedIds.entries()) {
      await query("update tasks set sort_order = $2 where id = $1", [id, i]);
    }
  });
}

export async function deleteTask(id: string): Promise<void> {
  const rows = await query("delete from tasks where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Task");
}

// --- Subtasks & comments ---

export async function listSubtasks(taskId: string): Promise<Subtask[]> {
  return many<Subtask>("select id, task_id, title, done, sort_order from subtasks where task_id = $1 order by sort_order, created_at", [taskId]);
}

export async function addSubtask(taskId: string, title: string): Promise<Subtask> {
  return must<Subtask>(
    "Subtask",
    `insert into subtasks (task_id, title, sort_order)
     values ($1, $2, coalesce((select max(sort_order) + 1 from subtasks where task_id = $1), 0))
     returning id, task_id, title, done, sort_order`,
    [taskId, title],
  );
}

export async function updateSubtask(id: string, patch: { title?: string; done?: boolean }): Promise<Subtask> {
  const { set, values } = buildUpdate(patch, ["title", "done"] as const, 2);
  return must<Subtask>("Subtask", `update subtasks set ${set || "title = title"} where id = $1 returning id, task_id, title, done, sort_order`, [id, ...values]);
}

export async function deleteSubtask(id: string): Promise<void> {
  await query("delete from subtasks where id = $1", [id]);
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  return many<TaskComment>(
    `select c.id, c.task_id, c.author_id, u.full_name as author_name, c.body, c.created_at
     from task_comments c left join users u on u.id = c.author_id where c.task_id = $1 order by c.created_at`,
    [taskId],
  );
}

export async function addTaskComment(taskId: string, authorId: string, body: string): Promise<TaskComment> {
  const c = await must<TaskComment>("Comment", "insert into task_comments (task_id, author_id, body) values ($1,$2,$3) returning *", [taskId, authorId, body]);
  const author = await one<{ fullName: string }>("select full_name from users where id = $1", [authorId]);
  return { ...c, authorName: author?.fullName ?? null };
}
