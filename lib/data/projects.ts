import { randomUUID } from "crypto";
import { store } from "./store";
import type { Project, Task, TaskPriority, TaskStatus } from "./types";

export async function listProjects(): Promise<Project[]> {
  return store.projects;
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return store.projects.find((p) => p.id === id);
}

export async function createProject(input: {
  clientId: string;
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
  };
  store.projects.push(project);
  return project;
}

export async function listTasks(): Promise<Task[]> {
  return store.tasks;
}

export async function listTasksByProject(projectId: string): Promise<Task[]> {
  return store.tasks.filter((t) => t.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
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
    sortOrder: store.tasks.filter((t) => t.projectId === input.projectId).length,
    createdBy: input.createdBy,
  };
  store.tasks.push(task);
  return task;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  task.status = status;
  return task;
}

export async function updateTaskPriority(taskId: string, priority: TaskPriority): Promise<Task> {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  task.priority = priority;
  return task;
}

export async function countActiveDeliveryProjects(): Promise<number> {
  return store.projects.filter((p) => p.status === "active_sprint").length;
}
