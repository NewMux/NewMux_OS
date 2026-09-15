import { randomUUID } from "crypto";
import { store } from "./store";
import { AppError } from "@/lib/api/errors";
import type {
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from "./types";

export async function listProjects(
  options: { includeArchived?: boolean } = {},
): Promise<Project[]> {
  return options.includeArchived
    ? store.projects
    : store.projects.filter((p) => !p.archivedAt);
}

export async function updateProject(
  id: string,
  patch: {
    name?: string;
    clientId?: string | null;
    status?: ProjectStatus;
    targetEndAt?: string | null;
    techStack?: string | null;
    hostingProvider?: string | null;
    controlPanelUrl?: string | null;
    domain?: string | null;
    domainRenewalDate?: string | null;
    githubUrl?: string | null;
  },
): Promise<Project> {
  const project = store.projects.find((p) => p.id === id);
  if (!project)
    throw new AppError("not_found", "That project no longer exists.");
  Object.assign(project, patch);
  return project;
}

export async function setProjectArchived(
  id: string,
  archived: boolean,
): Promise<Project> {
  const project = store.projects.find((p) => p.id === id);
  if (!project)
    throw new AppError("not_found", "That project no longer exists.");
  project.archivedAt = archived ? new Date().toISOString() : null;
  return project;
}

/**
 * Callers must check getReferences() first. Tasks are owned children — they
 * cannot exist without their project — so they go with it.
 */
export async function deleteProject(id: string): Promise<void> {
  const index = store.projects.findIndex((p) => p.id === id);
  if (index === -1)
    throw new AppError("not_found", "That project no longer exists.");
  store.tasks = store.tasks.filter((t) => t.projectId !== id);
  store.projects.splice(index, 1);
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return store.projects.find((p) => p.id === id);
}

export async function createProject(input: {
  /** Null for internal work that is not billed to a client. */
  clientId: string | null;
  productId?: string | null;
  name: string;
  createdBy: string;
}): Promise<Project> {
  const project: Project = {
    id: randomUUID(),
    clientId: input.clientId,
    productId: input.productId ?? null,
    name: input.name,
    status: "planning",
    startedAt: new Date().toISOString(),
    targetEndAt: null,
    createdBy: input.createdBy,
    techStack: null,
    hostingProvider: null,
    controlPanelUrl: null,
    domain: null,
    domainRenewalDate: null,
    githubUrl: null,
    profitSplitRuleId: null,
    archivedAt: null,
  };
  store.projects.push(project);
  return project;
}

export async function listTasks(): Promise<Task[]> {
  return store.tasks;
}

export async function listTasksByProject(projectId: string): Promise<Task[]> {
  return store.tasks
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createTask(input: {
  projectId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  assigneeId?: string | null;
  dueAt?: string | null;
  createdBy: string;
}): Promise<Task> {
  const task: Task = {
    id: randomUUID(),
    projectId: input.projectId,
    title: input.title,
    description: input.description ?? null,
    priority: input.priority,
    status: "todo",
    assigneeId: input.assigneeId ?? null,
    dueAt: input.dueAt ?? null,
    sortOrder: store.tasks.filter((t) => t.projectId === input.projectId)
      .length,
    createdBy: input.createdBy,
  };
  store.tasks.push(task);
  return task;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<Task> {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  task.status = status;
  return task;
}

/**
 * Board move: drops a task into `status` at `index` within that column and
 * renumbers the affected columns so sortOrder stays dense.
 */
export async function moveTask(
  taskId: string,
  status: TaskStatus,
  index: number,
): Promise<Task> {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");

  const fromStatus = task.status;
  task.status = status;

  const column = store.tasks
    .filter(
      (t) =>
        t.projectId === task.projectId &&
        t.status === status &&
        t.id !== task.id,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const clamped = Math.max(0, Math.min(index, column.length));
  column.splice(clamped, 0, task);
  column.forEach((t, i) => {
    t.sortOrder = i;
  });

  if (fromStatus !== status) {
    store.tasks
      .filter((t) => t.projectId === task.projectId && t.status === fromStatus)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((t, i) => {
        t.sortOrder = i;
      });
  }

  return task;
}

export async function updateTaskPriority(
  taskId: string,
  priority: TaskPriority,
): Promise<Task> {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  task.priority = priority;
  return task;
}

export async function countActiveDeliveryProjects(): Promise<number> {
  return store.projects.filter((p) => p.status === "active_sprint").length;
}
