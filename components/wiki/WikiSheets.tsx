"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, PlainRowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/Confirm";
import { DeleteRow } from "@/components/forms/Fields";
import { SPACE_ICONS, type SpaceIconName } from "./SpaceIcon";
import { useMutation } from "@/lib/useMutation";
import { SYS_COLORS, solidBg } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { KbPageSummary, KbSpace } from "@/lib/data/types";

/** New page: pick a space and (optionally) a template, then jump into the editor. */
export function NewPageSheet({
  open,
  onOpenChange,
  spaces,
  templates,
  defaultSpaceId,
  parentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  spaces: KbSpace[];
  templates: KbPageSummary[];
  defaultSpaceId?: string;
  parentId?: string;
}) {
  const router = useRouter();
  const { run } = useMutation();
  const [spaceId, setSpaceId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) {
      setSpaceId(defaultSpaceId ?? spaces[0]?.id ?? "");
      setTemplateId("");
      setTitle("");
    }
  }, [open, defaultSpaceId, spaces]);

  const submit = async () => {
    const res = await run<{ page: { id: string } }>("/api/kb/pages", { body: { spaceId, templateId, title, parentId: parentId ?? null }, refresh: false });
    if (res) router.push(`/wiki/${res.page.id}`);
    return !!res;
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={parentId ? "New Sub-page" : "New Page"} submitLabel="Create" canSubmit={!!spaceId} onSubmit={submit} size="auto">
      <ListSection>
        <PlainRowInput placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        {!parentId && (
          <FieldRow label="Space">
            <Select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
      </ListSection>
      <ListSection header="Start from">
        {[{ id: "", title: "Blank page", emoji: "📄" }, ...templates].map((t) => (
          <button
            key={t.id || "blank"}
            type="button"
            onClick={() => setTemplateId(t.id)}
            className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left hairline-b last:shadow-none active:bg-fill/20"
          >
            <span className="text-[20px]">{t.emoji ?? "📄"}</span>
            <span className="flex-1 text-body">{t.title.replace(/\s*template$/i, "") || "Untitled"}</span>
            {templateId === t.id && <span className="font-semibold text-accent">✓</span>}
          </button>
        ))}
      </ListSection>
    </FormSheet>
  );
}

export function SpaceSheet({ space, open, onOpenChange, canDelete }: { space?: KbSpace; open: boolean; onOpenChange: (o: boolean) => void; canDelete?: boolean }) {
  const router = useRouter();
  const { run } = useMutation();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<SpaceIconName>("book");
  const [color, setColor] = useState("blue");

  useEffect(() => {
    if (open) {
      setName(space?.name ?? "");
      setDescription(space?.description ?? "");
      setIcon((space?.icon as SpaceIconName) ?? "book");
      setColor(space?.color ?? "blue");
    }
  }, [open, space]);

  const submit = async () => {
    const body = { name, description, icon, color };
    if (space) return !!(await run(`/api/kb/spaces/${space.id}`, { method: "PATCH", body, success: "Saved" }));
    const res = await run<{ space: KbSpace }>("/api/kb/spaces", { body, success: "Space created", refresh: false });
    if (res) router.push(`/wiki/s/${res.space.id}`);
    return !!res;
  };

  const remove = async () => {
    if (!space) return;
    if (await confirm({ title: `Delete the “${space.name}” space?`, message: "Every page inside it is permanently deleted.", destructive: true, confirmLabel: "Delete Space" })) {
      if (await run(`/api/kb/spaces/${space.id}`, { method: "DELETE", success: "Space deleted", refresh: false })) {
        onOpenChange(false);
        router.push("/wiki");
        router.refresh();
      }
    }
  };

  const Icon = SPACE_ICONS[icon];
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={space ? "Edit Space" : "New Space"} submitLabel={space ? "Done" : "Create"} canSubmit={!!name.trim()} onSubmit={submit}>
      <div className="mb-6 flex justify-center">
        <span className={cn("flex h-20 w-20 items-center justify-center rounded-card text-white", solidBg[color as keyof typeof solidBg] ?? solidBg.blue)}>
          <Icon className="h-10 w-10" />
        </span>
      </div>
      <ListSection>
        <PlainRowInput placeholder="Space name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!space} />
        <PlainRowInput placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </ListSection>
      <ListSection>
        <div className="flex flex-wrap justify-center gap-3 px-4 py-4">
          {SYS_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn("h-8 w-8 rounded-full ring-offset-2 ring-offset-bg-elevated", solidBg[c], color === c && "ring-[3px] ring-label-3")}
            />
          ))}
        </div>
      </ListSection>
      <ListSection>
        <div className="grid grid-cols-6 gap-2 p-3">
          {(Object.keys(SPACE_ICONS) as SpaceIconName[]).map((k) => {
            const I = SPACE_ICONS[k];
            return (
              <button
                key={k}
                type="button"
                aria-label={k}
                onClick={() => setIcon(k)}
                className={cn("flex aspect-square items-center justify-center rounded-full", icon === k ? "bg-fill/25 text-label" : "bg-fill/10 text-label-2")}
              >
                <I className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </ListSection>
      {space && canDelete && <DeleteRow label="Delete Space" onClick={remove} />}
    </FormSheet>
  );
}
