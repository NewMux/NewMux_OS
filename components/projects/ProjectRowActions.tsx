"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { ApiError, apiFetch, useApiMutation } from "@/lib/api/client";
import {
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
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
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);

  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [techStack, setTechStack] = useState(project.techStack ?? "");
  const [hostingProvider, setHostingProvider] = useState(
    project.hostingProvider ?? "",
  );
  const [controlPanelUrl, setControlPanelUrl] = useState(
    project.controlPanelUrl ?? "",
  );
  const [domain, setDomain] = useState(project.domain ?? "");
  const [domainRenewalDate, setDomainRenewalDate] = useState(
    toDateInput(project.domainRenewalDate),
  );
  const [githubUrl, setGithubUrl] = useState(project.githubUrl ?? "");
  const [targetEndAt, setTargetEndAt] = useState(
    toDateInput(project.targetEndAt),
  );

  const edit = useApiMutation(
    (body: Record<string, string>) =>
      apiFetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    { successMessage: "Project updated.", onSuccess: () => setEditOpen(false) },
  );

  const archive = useApiMutation(
    (archived: boolean) =>
      apiFetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      }),
    {
      successMessage: project.archivedAt
        ? "Project restored."
        : "Project archived.",
    },
  );

  async function handleDelete(): Promise<boolean> {
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: "DELETE" });
      router.refresh();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "conflict") {
        setBlockedReasons(err.fields?.references ?? [err.message]);
        return false;
      }
      throw err;
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Actions for ${project.name}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => archive.run(!project.archivedAt)}>
            {project.archivedAt ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" /> Restore
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" /> Archive
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={() => {
              setBlockedReasons([]);
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title={`Edit ${project.name}`} size="md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              edit.run({
                name,
                status,
                techStack,
                hostingProvider,
                controlPanelUrl,
                domain,
                domainRenewalDate,
                githubUrl,
                targetEndAt,
              });
            }}
            className="flex flex-col gap-3"
          >
            <FormField label="Project name" error={edit.fieldErrors.name?.[0]}>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Status">
                {(props) => (
                  <select
                    {...props}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="min-h-[44px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm capitalize text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Target end date">
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={targetEndAt}
                    onChange={(e) => setTargetEndAt(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Tech stack">
                {(props) => (
                  <Input
                    {...props}
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Hosting provider">
                {(props) => (
                  <Input
                    {...props}
                    value={hostingProvider}
                    onChange={(e) => setHostingProvider(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Domain">
                {(props) => (
                  <Input
                    {...props}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Domain renewal">
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={domainRenewalDate}
                    onChange={(e) => setDomainRenewalDate(e.target.value)}
                  />
                )}
              </FormField>
              <FormField
                label="Control panel URL"
                error={edit.fieldErrors.controlPanelUrl?.[0]}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    placeholder="https://"
                    value={controlPanelUrl}
                    onChange={(e) => setControlPanelUrl(e.target.value)}
                  />
                )}
              </FormField>
              <FormField
                label="Repository URL"
                error={edit.fieldErrors.githubUrl?.[0]}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    placeholder="https://"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                )}
              </FormField>
            </div>

            <Button type="submit" loading={edit.pending} disabled={!name}>
              Save changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          blockedReasons.length
            ? `Cannot delete ${project.name}`
            : `Delete ${project.name}?`
        }
        description={
          blockedReasons.length
            ? "These records still reference this project. Archive it instead to keep the history."
            : "Its tasks will be deleted with it. This cannot be undone."
        }
        blockedReasons={blockedReasons}
        onConfirm={handleDelete}
      />
    </>
  );
}
