"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";
import type { Project, ProjectStatus } from "@/lib/data/types";

const STATUSES: ProjectStatus[] = [
  "planning",
  "active_sprint",
  "paused",
  "completed",
  "archived",
];

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export function ProjectRowActions({ project }: { project: Project }) {
  return (
    <EntityRowActions
      label="project"
      name={project.name}
      endpoint={`/api/projects/${project.id}`}
      archivedAt={project.archivedAt}
      canArchive
      deleteDescription="Its tasks will be deleted with it. This cannot be undone."
      fields={[
        {
          name: "name",
          label: "Project name",
          value: project.name,
          required: true,
          wide: true,
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          value: project.status,
          options: STATUSES.map((s) => ({
            value: s,
            label: s.replace("_", " "),
          })),
        },
        {
          name: "targetEndAt",
          label: "Target end date",
          type: "date",
          value: toDateInput(project.targetEndAt),
        },
        {
          name: "techStack",
          label: "Tech stack",
          value: project.techStack ?? "",
        },
        {
          name: "hostingProvider",
          label: "Hosting provider",
          value: project.hostingProvider ?? "",
        },
        { name: "domain", label: "Domain", value: project.domain ?? "" },
        {
          name: "domainRenewalDate",
          label: "Domain renewal",
          type: "date",
          value: toDateInput(project.domainRenewalDate),
        },
        {
          name: "controlPanelUrl",
          label: "Control panel URL",
          type: "url",
          placeholder: "https://",
          value: project.controlPanelUrl ?? "",
        },
        {
          name: "githubUrl",
          label: "Repository URL",
          type: "url",
          placeholder: "https://",
          value: project.githubUrl ?? "",
        },
      ]}
    />
  );
}
