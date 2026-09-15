"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { apiFetch, useApiMutation } from "@/lib/api/client";
import { Plus } from "lucide-react";
import type { Client } from "@/lib/data/types";

export function AddProjectModal({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");

  const { run, pending, fieldErrors } = useApiMutation(
    (body: { name: string; clientId: string | null }) =>
      apiFetch("/api/projects", { method: "POST", body: JSON.stringify(body) }),
    {
      successMessage: "Project created.",
      onSuccess: () => {
        setName("");
        setClientId("");
        setOpen(false);
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent title="New project">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run({ name, clientId: clientId || null });
          }}
          className="flex flex-col gap-3"
        >
          <FormField label="Project name" error={fieldErrors.name?.[0]}>
            {(props) => (
              <Input
                {...props}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
          </FormField>
          <FormField
            label="Client"
            hint="Leave as Internal for work that is not billed to a client."
          >
            {(props) => (
              <select
                {...props}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Internal (no client)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <Button type="submit" loading={pending} disabled={!name}>
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
