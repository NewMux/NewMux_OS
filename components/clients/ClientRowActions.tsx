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
import type { Client } from "@/lib/data/types";

export function ClientRowActions({ client }: { client: Client }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);

  const [name, setName] = useState(client.name);
  const [nameArabic, setNameArabic] = useState(client.nameArabic ?? "");
  const [contactPerson, setContactPerson] = useState(
    client.contactPerson ?? "",
  );
  const [contactEmail, setContactEmail] = useState(client.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(client.contactPhone ?? "");

  const edit = useApiMutation(
    (body: Record<string, string>) =>
      apiFetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    { successMessage: "Client updated.", onSuccess: () => setEditOpen(false) },
  );

  const archive = useApiMutation(
    (archived: boolean) =>
      apiFetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      }),
    {
      successMessage: client.archivedAt
        ? "Client restored."
        : "Client archived.",
    },
  );

  /** Delete is attempted directly; a 409 turns the dialog into an explanation
   * rather than closing it, so returning false keeps it open. */
  async function handleDelete(): Promise<boolean> {
    try {
      await apiFetch(`/api/clients/${client.id}`, { method: "DELETE" });
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
            aria-label={`Actions for ${client.name}`}
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
          <DropdownMenuItem onSelect={() => archive.run(!client.archivedAt)}>
            {client.archivedAt ? (
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
        <DialogContent title={`Edit ${client.name}`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              edit.run({
                name,
                nameArabic,
                contactPerson,
                contactEmail,
                contactPhone,
              });
            }}
            className="flex flex-col gap-3"
          >
            <FormField
              label="Client / company name"
              error={edit.fieldErrors.name?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
            </FormField>
            <FormField label="Arabic name">
              {(props) => (
                <Input
                  {...props}
                  dir="rtl"
                  value={nameArabic}
                  onChange={(e) => setNameArabic(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Contact person">
              {(props) => (
                <Input
                  {...props}
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              )}
            </FormField>
            <FormField
              label="Contact email"
              error={edit.fieldErrors.contactEmail?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Contact phone">
              {(props) => (
                <Input
                  {...props}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              )}
            </FormField>
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
            ? `Cannot delete ${client.name}`
            : `Delete ${client.name}?`
        }
        description={
          blockedReasons.length
            ? "These records still reference this client. Archive it instead to keep the history."
            : "This client has no linked records, so deleting is safe. This cannot be undone."
        }
        blockedReasons={blockedReasons}
        onConfirm={handleDelete}
      />
    </>
  );
}
