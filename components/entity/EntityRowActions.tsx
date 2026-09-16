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
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";
import { ApiError, apiFetch, useApiMutation } from "@/lib/api/client";
import {
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";

export type EditField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "url"
    | "date"
    | "datetime-local"
    | "number"
    | "textarea"
    | "select";
  value: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  dir?: "rtl" | "ltr";
  /** Full width in the two-column grid. */
  wide?: boolean;
  step?: string;
};

/**
 * One implementation of the row-action pattern for every entity: edit dialog,
 * optional archive/restore, and a delete that turns a 409 into an explanation
 * instead of failing silently.
 *
 * Fields are declarative so each entity supplies a list rather than another
 * near-identical component.
 */
export function EntityRowActions({
  label,
  name,
  endpoint,
  fields,
  archivedAt,
  canArchive = false,
  deleteDescription,
  onEdited,
}: {
  /** Entity noun for the copy, e.g. "client". */
  label: string;
  /** This record's display name. */
  name: string;
  /** API base for this record, e.g. `/api/clients/abc`. */
  endpoint: string;
  fields: EditField[];
  archivedAt?: string | null;
  canArchive?: boolean;
  deleteDescription?: string;
  onEdited?: () => void;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.value])),
  );

  const Label = `${label[0]!.toUpperCase()}${label.slice(1)}`;

  const edit = useApiMutation(
    (body: Record<string, string>) =>
      apiFetch(endpoint, { method: "PATCH", body: JSON.stringify(body) }),
    {
      successMessage: `${Label} updated.`,
      onSuccess: () => {
        setEditOpen(false);
        onEdited?.();
      },
    },
  );

  const archive = useApiMutation(
    (archived: boolean) =>
      apiFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      }),
    {
      successMessage: archivedAt ? `${Label} restored.` : `${Label} archived.`,
    },
  );

  async function handleDelete(): Promise<boolean> {
    try {
      await apiFetch(endpoint, { method: "DELETE" });
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

  const set = (field: string, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Actions for ${name}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() => {
              setValues(
                Object.fromEntries(fields.map((f) => [f.name, f.value])),
              );
              setEditOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          {canArchive && (
            <DropdownMenuItem onSelect={() => archive.run(!archivedAt)}>
              {archivedAt ? (
                <>
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </>
              )}
            </DropdownMenuItem>
          )}
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
        <DialogContent
          title={`Edit ${name}`}
          size={fields.length > 4 ? "md" : "sm"}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              edit.run(values);
            }}
            className="flex flex-col gap-3"
          >
            <div
              className={
                fields.length > 4
                  ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                  : "flex flex-col gap-3"
              }
            >
              {fields.map((field) => (
                <FormField
                  key={field.name}
                  label={field.label}
                  hint={field.hint}
                  error={edit.fieldErrors[field.name]?.[0]}
                  className={field.wide ? "sm:col-span-2" : undefined}
                >
                  {(props) =>
                    field.type === "textarea" ? (
                      <Textarea
                        {...props}
                        rows={3}
                        value={values[field.name] ?? ""}
                        onChange={(e) => set(field.name, e.target.value)}
                      />
                    ) : field.type === "select" ? (
                      <select
                        {...props}
                        value={values[field.name] ?? ""}
                        onChange={(e) => set(field.name, e.target.value)}
                        className="min-h-[44px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {field.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        {...props}
                        type={field.type ?? "text"}
                        dir={field.dir}
                        step={field.step}
                        placeholder={field.placeholder}
                        required={field.required}
                        value={values[field.name] ?? ""}
                        onChange={(e) => set(field.name, e.target.value)}
                      />
                    )
                  }
                </FormField>
              ))}
            </div>
            <Button type="submit" loading={edit.pending}>
              Save changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          blockedReasons.length ? `Cannot delete ${name}` : `Delete ${name}?`
        }
        description={
          blockedReasons.length
            ? `These records still reference this ${label}.${canArchive ? " Archive it instead to keep the history." : ""}`
            : (deleteDescription ?? "This cannot be undone.")
        }
        blockedReasons={blockedReasons}
        onConfirm={handleDelete}
      />
    </>
  );
}
