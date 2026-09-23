"use client";

import { useState } from "react";
import { ExternalLink, GitBranch, Globe, KeyRound, Pencil, Plus, Server, Layers, Archive } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { Menu } from "@/components/ui/Menu";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TaskBoard } from "@/components/work/TaskBoard";
import { TaskRow } from "@/components/work/TaskRow";
import { NewTaskSheet, ProjectSheet } from "@/components/work/WorkSheets";
import { NewLinkedPageButton } from "@/components/crm/DealActions";
import type { Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { DOC_STATUS, DOC_TYPE, PROJECT_STATUS, TASK_STATUS } from "@/lib/labels";
import { centsToDisplay } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/time";
import { asSysColor } from "@/lib/colors";
import type { KbPageSummary, Project, TaskStatus, TaskWithMeta } from "@/lib/data/types";
import type { DocumentListItem } from "@/lib/data/documents";
import type { MeetingListItem } from "@/lib/data/meetings";

type Tab = "board" | "list" | "details";

export function ProjectDetail(props: {
  project: Project;
  clientName: string | null;
  tasks: TaskWithMeta[];
  documents: DocumentListItem[];
  secretCount: number;
  pages: KbPageSummary[];
  meetings: MeetingListItem[];
  users: Option[];
  clients: Option[];
  admin: boolean;
}) {
  const { project, clientName, tasks, documents, secretCount, pages, meetings, users, clients, admin } = props;
  const [tab, setTab] = useState<Tab>("board");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<TaskStatus | null>(null);
  const { run } = useMutation();
  const done = tasks.filter((t) => t.status === "done").length;
  const color = asSysColor(project.color);

  return (
    <Page
      wide={tab === "board"}
      title={project.name}
      back={{ href: "/work", label: "Work" }}
      subtitle={
        <span className="flex items-center gap-2">
          <ProgressRing value={tasks.length ? done / tasks.length : 0} size={18} stroke={3} color={`rgb(var(--${color}))`} />
          {clientName ?? "Internal"} · {done}/{tasks.length} done
          <Badge color={PROJECT_STATUS[project.status].color}>{PROJECT_STATUS[project.status].label}</Badge>
        </span>
      }
      actions={
        <>
          <NavButton label="New task" onClick={() => setAdding("todo")}>
            <Plus className="h-5 w-5" />
          </NavButton>
          <Menu
            items={[
              { label: "Project Info", icon: Pencil, onSelect: () => setEditing(true) },
              project.status !== "archived"
                ? { label: "Archive Project", icon: Archive, onSelect: () => run(`/api/projects/${project.id}`, { method: "PATCH", body: { status: "archived" }, success: "Archived" }) }
                : { label: "Unarchive", icon: Archive, onSelect: () => run(`/api/projects/${project.id}`, { method: "PATCH", body: { status: "active_sprint" }, success: "Restored" }) },
            ]}
          />
        </>
      }
      accessory={
        <SegmentedControl
          className="max-w-md"
          value={tab}
          onChange={setTab}
          options={[
            { value: "board", label: "Board" },
            { value: "list", label: "List" },
            { value: "details", label: "Details" },
          ]}
        />
      }
    >
      {tab === "board" && <TaskBoard tasks={tasks} onAdd={setAdding} />}

      {tab === "list" && (
        <div className="mx-auto max-w-2xl">
          {(["todo", "in_progress", "in_review", "done"] as TaskStatus[]).map((s) => {
            const items = tasks.filter((t) => t.status === s);
            if (!items.length) return null;
            return (
              <ListSection key={s} header={`${TASK_STATUS[s].label} · ${items.length}`}>
                {items.map((t) => (
                  <TaskRow key={t.id} task={t} showProject={false} />
                ))}
              </ListSection>
            );
          })}
          {tasks.length === 0 && <p className="py-10 text-center text-subhead text-label-2">No tasks yet — tap + to add one.</p>}
        </div>
      )}

      {tab === "details" && (
        <div className="mx-auto grid max-w-4xl gap-x-6 lg:grid-cols-2">
          <div>
            {project.description && (
              <ListSection header="About">
                <p className="whitespace-pre-wrap px-4 py-3 text-body">{project.description}</p>
              </ListSection>
            )}
            <ListSection header="Timeline">
              <ListRow title="Started" detail={formatDate(project.startedAt)} />
              <ListRow title="Target end" detail={formatDate(project.targetEndAt)} />
            </ListSection>
            <ListSection header="Technical" action={<button className="text-subhead text-accent" onClick={() => setEditing(true)}>Edit</button>}>
              <ListRow leading={<IconTile icon={Layers} color="indigo" size="sm" />} title="Stack" detail={project.techStack ?? "—"} />
              <ListRow leading={<IconTile icon={Server} color="teal" size="sm" />} title="Hosting" detail={project.hostingProvider ?? "—"} />
              <ListRow
                leading={<IconTile icon={Globe} color="blue" size="sm" />}
                title="Domain"
                subtitle={project.domainRenewalDate ? `Renews ${formatDate(project.domainRenewalDate)}` : undefined}
                detail={project.domain ?? "—"}
              />
              {project.githubUrl && (
                <ListRow leading={<IconTile icon={GitBranch} color="gray" size="sm" />} title="Repository" trailing={<a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-accent"><ExternalLink className="h-4 w-4" /></a>} />
              )}
              {project.controlPanelUrl && (
                <ListRow leading={<IconTile icon={ExternalLink} color="gray" size="sm" />} title="Control panel" trailing={<a href={project.controlPanelUrl} target="_blank" rel="noreferrer" className="text-accent"><ExternalLink className="h-4 w-4" /></a>} />
              )}
              <ListRow href="/vault" leading={<IconTile icon={KeyRound} color="gray" size="sm" />} title="Credentials in Vault" detail={secretCount} />
            </ListSection>
          </div>
          <div>
            <ListSection header="Wiki">
              {pages.map((p) => (
                <ListRow key={p.id} href={`/wiki/${p.id}`} leading={<span className="text-[20px]">{p.emoji ?? "📄"}</span>} title={p.title || "Untitled"} subtitle={p.spaceName} />
              ))}
              <NewLinkedPageButton link={{ projectId: project.id, clientId: project.clientId }} title={`${project.name} — notes`} />
            </ListSection>
            {meetings.length > 0 && (
              <ListSection header="Meetings">
                {meetings.slice(-5).map((m) => (
                  <ListRow key={m.id} href="/meetings" title={m.title} subtitle={`${formatDate(m.startsAt)} · ${formatTime(m.startsAt)}`} />
                ))}
              </ListSection>
            )}
            {admin && (
              <ListSection header="Invoices & Quotes" action={<a href={`/documents/new?type=invoice&projectId=${project.id}${project.clientId ? `&clientId=${project.clientId}` : ""}`} className="text-subhead text-accent">New</a>}>
                {documents.map((d) => (
                  <ListRow
                    key={d.id}
                    href={`/documents/${d.id}`}
                    title={d.documentNumber}
                    subtitle={DOC_TYPE[d.type]}
                    detail={centsToDisplay(d.totalCents, d.currency)}
                    trailing={<Badge color={DOC_STATUS[d.status].color}>{DOC_STATUS[d.status].label}</Badge>}
                  />
                ))}
                {documents.length === 0 && <ListRow title="No documents yet" />}
              </ListSection>
            )}
          </div>
        </div>
      )}

      <ProjectSheet project={project} open={editing} onOpenChange={setEditing} clients={clients} canDelete={admin} />
      <NewTaskSheet
        open={adding !== null}
        onOpenChange={(o) => !o && setAdding(null)}
        projects={[{ id: project.id, name: project.name }]}
        users={users}
        defaultProjectId={project.id}
        defaultStatus={adding ?? undefined}
      />
    </Page>
  );
}
