"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/Confirm";
import { DeleteRow, type Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { PROJECT_STATUS, TASK_PRIORITY } from "@/lib/labels";
import { PROJECT_COLORS } from "@/lib/validators/project";
import { solidBg, type SysColor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { todayYmd } from "@/lib/time";
import type { Meeting, Project, ProjectStatus, TaskPriority } from "@/lib/data/types";

// ---------------- Project ----------------

export function ProjectSheet({ project, open, onOpenChange, clients, canDelete }: { project?: Project; open: boolean; onOpenChange: (o: boolean) => void; clients: Option[]; canDelete?: boolean }) {
  const { run } = useMutation();
  const router = useRouter();
  const confirm = useConfirm();
  const blank = {
    name: "",
    clientId: "",
    description: "",
    color: "blue",
    status: "planning" as ProjectStatus,
    startedAt: todayYmd(),
    targetEndAt: "",
    techStack: "",
    hostingProvider: "",
    domain: "",
    domainRenewalDate: "",
    githubUrl: "",
    controlPanelUrl: "",
  };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      project
        ? {
            name: project.name,
            clientId: project.clientId ?? "",
            description: project.description ?? "",
            color: project.color,
            status: project.status,
            startedAt: project.startedAt ?? "",
            targetEndAt: project.targetEndAt ?? "",
            techStack: project.techStack ?? "",
            hostingProvider: project.hostingProvider ?? "",
            domain: project.domain ?? "",
            domainRenewalDate: project.domainRenewalDate ?? "",
            githubUrl: project.githubUrl ?? "",
            controlPanelUrl: project.controlPanelUrl ?? "",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

  const submit = async () => {
    // Team members without CRM access get no client list — never clear the client on their behalf.
    const { clientId: _omitClient, ...rest } = f;
    const body = clients.length > 0 ? f : project ? rest : { ...rest, clientId: "" };
    if (project) return !!(await run(`/api/projects/${project.id}`, { method: "PATCH", body, success: "Saved" }));
    const res = await run<{ project: Project }>("/api/projects", { body, success: "Project created", refresh: false });
    if (res) router.push(`/projects/${res.project.id}`);
    return !!res;
  };

  const remove = async () => {
    if (!project) return;
    if (await confirm({ title: `Delete “${project.name}”?`, message: "All of its tasks are deleted. Projects with invoices, payments or expenses can’t be deleted: archive them instead.", destructive: true, confirmLabel: "Delete Project" })) {
      if (await run(`/api/projects/${project.id}`, { method: "DELETE", success: "Project deleted", refresh: false })) {
        onOpenChange(false);
        router.push("/work");
        router.refresh();
      }
    }
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={project ? "Project Info" : "New Project"} submitLabel={project ? "Done" : "Create"} canSubmit={!!f.name.trim()} onSubmit={submit}>
      <ListSection>
        <PlainRowInput placeholder="Project name" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!project} />
        <div className="px-4 py-2.5">
          <Textarea placeholder="Description" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
      </ListSection>
      <ListSection>
        <div className="flex flex-wrap justify-center gap-3 px-4 py-4">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={f.color === c}
              onClick={() => set("color", c)}
              className={cn("h-8 w-8 rounded-full ring-offset-2 ring-offset-bg-elevated transition", solidBg[c as SysColor], f.color === c && "ring-[3px] ring-label-3")}
            />
          ))}
        </div>
      </ListSection>
      <ListSection>
        <FieldRow label="Client" className={clients.length === 0 ? "hidden" : undefined}>
          <Select value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">Internal</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Status">
          <Select value={f.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
            {Object.entries(PROJECT_STATUS).map(([v, m]) => (
              <option key={v} value={v}>
                {m.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Start">
          <RowInput type="date" value={f.startedAt} onChange={(e) => set("startedAt", e.target.value)} />
        </FieldRow>
        <FieldRow label="Target end">
          <RowInput type="date" value={f.targetEndAt} onChange={(e) => set("targetEndAt", e.target.value)} />
        </FieldRow>
      </ListSection>
      <ListSection header="Technical" footer="Passwords and keys belong in the Vault — never here.">
        <PlainRowInput placeholder="Tech stack" value={f.techStack} onChange={(e) => set("techStack", e.target.value)} />
        <PlainRowInput placeholder="Hosting provider" value={f.hostingProvider} onChange={(e) => set("hostingProvider", e.target.value)} />
        <PlainRowInput placeholder="Domain" autoCapitalize="none" value={f.domain} onChange={(e) => set("domain", e.target.value)} />
        <FieldRow label="Domain renewal">
          <RowInput type="date" value={f.domainRenewalDate} onChange={(e) => set("domainRenewalDate", e.target.value)} />
        </FieldRow>
        <PlainRowInput placeholder="GitHub URL" autoCapitalize="none" inputMode="url" value={f.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} />
        <PlainRowInput placeholder="Control panel URL" autoCapitalize="none" inputMode="url" value={f.controlPanelUrl} onChange={(e) => set("controlPanelUrl", e.target.value)} />
      </ListSection>
      {project && canDelete && <DeleteRow label="Delete Project" onClick={remove} />}
    </FormSheet>
  );
}

// ---------------- New task (quick add) ----------------

export function NewTaskSheet({
  open,
  onOpenChange,
  projects,
  users,
  defaultProjectId,
  defaultStatus,
  defaultAssigneeId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: Option[];
  users: Option[];
  defaultProjectId?: string;
  defaultStatus?: string;
  defaultAssigneeId?: string;
}) {
  const { run } = useMutation();
  const [f, setF] = useState({ title: "", description: "", projectId: "", priority: "medium" as TaskPriority, dueAt: "", assigneeId: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) setF({ title: "", description: "", projectId: defaultProjectId ?? projects[0]?.id ?? "", priority: "medium", dueAt: "", assigneeId: defaultAssigneeId ?? "" });
  }, [open, defaultProjectId, defaultAssigneeId, projects]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New Task"
      submitLabel="Add"
      canSubmit={!!f.title.trim() && !!f.projectId}
      onSubmit={async () => !!(await run("/api/tasks", { body: { ...f, status: defaultStatus }, success: "Task added" }))}
    >
      <ListSection>
        <PlainRowInput placeholder="Title" value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus />
        <div className="px-4 py-2.5">
          <Textarea placeholder="Notes" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
      </ListSection>
      <ListSection>
        {!defaultProjectId && (
          <FieldRow label="Project">
            <Select value={f.projectId} onChange={(e) => set("projectId", e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
        <FieldRow label="Due">
          <RowInput type="date" value={f.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
        </FieldRow>
        <FieldRow label="Priority">
          <Select value={f.priority} onChange={(e) => set("priority", e.target.value as TaskPriority)}>
            {Object.entries(TASK_PRIORITY).map(([v, m]) => (
              <option key={v} value={v}>
                {m.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Assignee">
          <Select value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>
    </FormSheet>
  );
}

// ---------------- Meeting ----------------

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function MeetingSheet({
  meeting,
  open,
  onOpenChange,
  projects,
  clients,
}: {
  meeting?: Meeting;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: Option[];
  clients: Option[];
}) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const blank = () => {
    const d = new Date(Date.now() + 3600_000);
    d.setMinutes(0, 0, 0);
    return { title: "", startsAt: toLocalInput(d.toISOString()), durationMinutes: "60", location: "", linkedProjectId: "", linkedClientId: "", notes: "", recurring: "none" };
  };
  const [f, setF] = useState(blank);
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      meeting
        ? {
            title: meeting.title,
            startsAt: toLocalInput(meeting.startsAt),
            durationMinutes: String(meeting.durationMinutes),
            location: meeting.location ?? "",
            linkedProjectId: meeting.linkedProjectId ?? "",
            linkedClientId: meeting.linkedClientId ?? "",
            notes: meeting.notes ?? "",
            recurring: meeting.recurring,
          }
        : blank(),
    );
  }, [open, meeting]);

  const submit = async () => {
    const payload = {
      ...f,
      startsAt: new Date(f.startsAt).toISOString(),
      durationMinutes: Number(f.durationMinutes),
      linkedDealId: meeting?.linkedDealId ?? null,
      // Keep the client link when the editor can't see clients (team role).
      linkedClientId: clients.length ? f.linkedClientId : (meeting?.linkedClientId ?? null),
    };
    return !!(meeting
      ? await run(`/api/meetings/${meeting.id}`, { method: "PATCH", body: payload, success: "Saved" })
      : await run("/api/meetings", { body: payload, success: "Meeting added" }));
  };

  const remove = async () => {
    if (!meeting) return;
    if (await confirm({ title: `Delete “${meeting.title}”?`, destructive: true, confirmLabel: "Delete Event" })) {
      if (await run(`/api/meetings/${meeting.id}`, { method: "DELETE", success: "Deleted" })) onOpenChange(false);
    }
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={meeting ? "Edit Event" : "New Event"} submitLabel={meeting ? "Done" : "Add"} canSubmit={!!f.title.trim() && !!f.startsAt} onSubmit={submit}>
      <ListSection>
        <PlainRowInput placeholder="Title" value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus={!meeting} />
        <PlainRowInput placeholder="Location or video call" value={f.location} onChange={(e) => set("location", e.target.value)} />
      </ListSection>
      <ListSection>
        <FieldRow label="Starts">
          <RowInput type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </FieldRow>
        <FieldRow label="Duration">
          <Select value={f.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)}>
            {[15, 30, 45, 60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Repeat">
          <Select value={f.recurring} onChange={(e) => set("recurring", e.target.value)}>
            <option value="none">Never</option>
            <option value="weekly">Every Week</option>
            <option value="monthly">Every Month</option>
          </Select>
        </FieldRow>
      </ListSection>
      <ListSection>
        <FieldRow label="Client" className={clients.length === 0 ? "hidden" : undefined}>
          <Select value={f.linkedClientId} onChange={(e) => set("linkedClientId", e.target.value)}>
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Project">
          <Select value={f.linkedProjectId} onChange={(e) => set("linkedProjectId", e.target.value)}>
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>
      <ListSection>
        <div className="px-4 py-2.5">
          <Textarea placeholder="Agenda" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {meeting && <DeleteRow label="Delete Event" onClick={remove} />}
    </FormSheet>
  );
}
