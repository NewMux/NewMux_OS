"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code2,
  Link2,
  Undo2,
  Redo2,
  Star,
  Copy,
  FolderInput,
  Trash2,
  LayoutTemplate,
  Heading,
  Plus,
  ChevronRight,
  Link as LinkIcon,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { Page, NavButton } from "@/components/ui/Page";
import { Menu } from "@/components/ui/Menu";
import { FormSheet } from "@/components/ui/FormSheet";
import { Sheet, SheetButton, SheetIconButton } from "@/components/ui/Sheet";
import { FieldRow, ListRow, ListSection } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/Confirm";
import { NewPageSheet } from "@/components/wiki/WikiSheets";
import type { Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { useIsDesktop } from "@/lib/hooks/useMediaQuery";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { KbContent, KbPage, KbPageSummary, KbSpace } from "@/lib/data/types";

type SaveState = "saved" | "saving" | "dirty" | "error";

const EMOJIS = ["📄", "📝", "📋", "📌", "💡", "🚀", "🎯", "✅", "⚙️", "🧰", "🧱", "🔐", "💳", "🧾", "📈", "📊", "🗓️", "👋", "🤝", "☕", "✈️", "🏗️", "🐘", "🌐", "📣", "🛠️", "📦", "🧪", "🎨", "📚", "🔥", "⭐"];

export function WikiEditor({
  page,
  space,
  ancestors,
  subPages: children,
  favorite: initialFavorite,
  spaces,
  templates,
  links,
  canLinkCrm,
}: {
  page: KbPage;
  space: KbSpace;
  ancestors: { id: string; title: string; emoji: string | null }[];
  subPages: KbPageSummary[];
  favorite: boolean;
  spaces: KbSpace[];
  templates: KbPageSummary[];
  links: { clients: Option[]; projects: Option[]; deals: Option[] };
  canLinkCrm: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run } = useMutation();
  const desktop = useIsDesktop();
  const [title, setTitle] = useState(page.title);
  const [emoji, setEmoji] = useState(page.emoji);
  const [favorite, setFavorite] = useState(initialFavorite);
  const [save, setSave] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(page.updatedAt);
  const [focused, setFocused] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const pending = useRef<{ title?: string; content?: KbContent; emoji?: string | null }>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const body = pending.current;
    if (!Object.keys(body).length) return;
    pending.current = {};
    setSave("saving");
    try {
      const res = await fetch(`/api/kb/pages/${page.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { page: { updatedAt: string } };
      setSavedAt(json.page.updatedAt);
      setSave(Object.keys(pending.current).length ? "dirty" : "saved");
    } catch {
      pending.current = { ...body, ...pending.current };
      setSave("error");
    }
  }, [page.id]);

  const queue = useCallback(
    (patch: { title?: string; content?: KbContent; emoji?: string | null }) => {
      pending.current = { ...pending.current, ...patch };
      setSave("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  // Save on leave / tab hide so nothing is lost.
  useEffect(() => {
    const onHide = () => {
      if (Object.keys(pending.current).length) {
        navigator.sendBeacon?.(`/api/kb/pages/${page.id}/beacon`, JSON.stringify(pending.current));
        void flush();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush, page.id]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: !desktop ? false : true, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: page.content as object,
    editorProps: { attributes: { class: "prose-notes", "aria-label": "Page content" } },
    onUpdate: ({ editor: e }) => queue({ content: e.getJSON() as KbContent }),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  });

  const toggleFavorite = async () => {
    const next = !favorite;
    setFavorite(next);
    if (!(await run(`/api/kb/pages/${page.id}/favorite`, { body: { favorite: next }, success: next ? "Added to Favorites" : "Removed from Favorites" }))) setFavorite(!next);
  };

  const duplicate = async () => {
    await flush();
    const res = await run<{ page: { id: string } }>(`/api/kb/pages/${page.id}/duplicate`, { success: "Duplicated", refresh: false });
    if (res) router.push(`/wiki/${res.page.id}`);
  };

  const toggleTemplate = async () => {
    await flush();
    await run(`/api/kb/pages/${page.id}`, { method: "PATCH", body: { isTemplate: !page.isTemplate }, success: page.isTemplate ? "No longer a template" : "Saved as template" });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${title || "Untitled"}”?`,
      message: children.length ? `Its ${children.length} sub-page(s) are deleted too.` : "This can't be undone.",
      destructive: true,
      confirmLabel: "Delete Page",
    });
    if (!ok) return;
    pending.current = {};
    if (await run(`/api/kb/pages/${page.id}`, { method: "DELETE", success: "Page deleted", refresh: false })) {
      router.push(`/wiki/s/${space.id}`);
      router.refresh();
    }
  };

  const linkedChips = [
    page.clientId && { href: `/clients/${page.clientId}`, label: links.clients.find((c) => c.id === page.clientId)?.name ?? "Client" },
    page.projectId && { href: `/projects/${page.projectId}`, label: links.projects.find((p) => p.id === page.projectId)?.name ?? "Project" },
    page.dealId && { href: `/crm/deals/${page.dealId}`, label: links.deals.find((d) => d.id === page.dealId)?.name ?? "Deal" },
  ].filter(Boolean) as { href: string; label: string }[];

  const back = ancestors.length ? { href: `/wiki/${ancestors[ancestors.length - 1]!.id}`, label: ancestors[ancestors.length - 1]!.title || "Back" } : { href: `/wiki/s/${space.id}`, label: space.name };

  return (
    <Page
      title={title || "Untitled"}
      hideLargeTitle
      back={back}
      actions={
        <>
          <NavButton label={favorite ? "Remove from favorites" : "Add to favorites"} onClick={toggleFavorite}>
            <Star className={cn("h-[18px] w-[18px]", favorite && "fill-ios-yellow text-ios-yellow")} />
          </NavButton>
          <Menu
            items={[
              { label: "Add Sub-page", icon: Plus, onSelect: () => setSubOpen(true) },
              { label: "Move…", icon: FolderInput, onSelect: () => setMoveOpen(true) },
              { label: "Link to…", icon: LinkIcon, onSelect: () => setLinkOpen(true) },
              { label: "Duplicate", icon: Copy, onSelect: duplicate },
              { label: page.isTemplate ? "Remove from Templates" : "Save as Template", icon: LayoutTemplate, onSelect: toggleTemplate },
              "separator",
              { label: "Delete Page", icon: Trash2, destructive: true, onSelect: remove },
            ]}
          />
        </>
      }
    >
      {/* Notes-style: on iPad/Mac the page is a sheet of paper on the grey canvas. */}
      <article className="mx-auto max-w-[760px] md:rounded-card md:bg-bg-elevated md:px-12 md:pb-12 md:pt-10">
        {ancestors.length > 0 && (
          <nav aria-label="Breadcrumbs" className="mb-3 flex flex-wrap items-center gap-1 text-footnote text-label-2">
            <Link href={`/wiki/s/${space.id}`} className="hover:text-accent">
              {space.name}
            </Link>
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <Link href={`/wiki/${a.id}`} className="hover:text-accent">
                  {a.title || "Untitled"}
                </Link>
              </span>
            ))}
          </nav>
        )}

        <button type="button" onClick={() => setEmojiOpen(true)} aria-label="Change icon" className="press mb-1 text-[52px] leading-none">
          {emoji ?? "📄"}
        </button>
        <textarea
          ref={(el) => {
            // Auto-grow for browsers without field-sizing support (older iOS Safari).
            if (el) {
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }
          }}
          value={title}
          rows={1}
          onChange={(e) => {
            setTitle(e.target.value);
            queue({ title: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor?.commands.focus("start");
            }
          }}
          placeholder="Untitled"
          aria-label="Title"
          className="block w-full resize-none overflow-hidden bg-transparent text-large-title placeholder:text-label-3 focus:outline-none [field-sizing:content]"
        />
        <div className="mb-5 mt-1 flex flex-wrap items-center gap-2 text-footnote text-label-2">
          <span>
            {save === "saving" ? "Saving…" : save === "dirty" ? "Editing…" : save === "error" ? <span className="text-ios-red">Not saved — retrying on next edit</span> : `Edited ${timeAgo(savedAt)}`}
            {page.updatedByName && save === "saved" ? ` by ${page.updatedByName.split(" ")[0]}` : ""}
          </span>
          {page.isTemplate && <span className="rounded-full bg-ios-purple/15 px-2 py-0.5 font-semibold text-ios-purple">Template</span>}
          {linkedChips.map((c) => (
            <Link key={c.href} href={c.href} className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">
              <LinkIcon className="h-3 w-3" />
              {c.label}
            </Link>
          ))}
        </div>

        {desktop && editor && <Toolbar editor={editor} className="glass sticky top-[64px] z-20 mb-6 w-fit max-w-full rounded-full px-1.5" />}
        <EditorContent editor={editor} />

        {children.length > 0 && (
          <ListSection header="Sub-pages" className="mt-10">
            {children.map((c) => (
              <ListRow key={c.id} href={`/wiki/${c.id}`} leading={<span className="text-[20px]">{c.emoji ?? "📄"}</span>} title={c.title || "Untitled"} subtitle={timeAgo(c.updatedAt)} />
            ))}
          </ListSection>
        )}
      </article>

      {/* iPhone: formatting bar floats above the keyboard while editing. */}
      {!desktop && editor && focused && <KeyboardToolbar editor={editor} />}

      <Sheet
        open={emojiOpen}
        onOpenChange={setEmojiOpen}
        title="Page Icon"
        size="auto"
        left={<SheetIconButton label="Close" onClick={() => setEmojiOpen(false)} />}
        right={
          <SheetButton
            onClick={() => {
              setEmoji(null);
              queue({ emoji: null });
              setEmojiOpen(false);
            }}
          >
            Remove
          </SheetButton>
        }
      >
        <div className="grid grid-cols-8 gap-1 pb-4">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setEmoji(e);
                queue({ emoji: e });
                setEmojiOpen(false);
              }}
              className={cn("flex aspect-square items-center justify-center rounded-xl text-[26px] active:bg-fill/20", emoji === e && "bg-fill/20")}
            >
              {e}
            </button>
          ))}
        </div>
      </Sheet>

      <MoveSheet open={moveOpen} onOpenChange={setMoveOpen} page={page} spaces={spaces} onBeforeSave={flush} />
      <LinkSheet open={linkOpen} onOpenChange={setLinkOpen} page={page} links={links} canLinkCrm={canLinkCrm} onBeforeSave={flush} />
      <NewPageSheet open={subOpen} onOpenChange={setSubOpen} spaces={spaces} templates={templates} defaultSpaceId={space.id} parentId={page.id} />
    </Page>
  );
}

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors", active ? "bg-accent/15 text-accent" : "text-label hover:bg-fill/10")}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, className }: { editor: Editor; className?: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (!url || url === "https://") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url }).run();
  };
  const headingLevel = [1, 2, 3].find((l) => editor.isActive("heading", { level: l }));

  return (
    <div className={cn("no-scrollbar flex items-center gap-0.5 overflow-x-auto p-1", className)}>
      <ToolButton
        label="Heading"
        active={!!headingLevel}
        onClick={() => {
          if (!headingLevel) c().setHeading({ level: 1 }).run();
          else if (headingLevel < 3) c().setHeading({ level: (headingLevel + 1) as 2 | 3 }).run();
          else c().setParagraph().run();
        }}
      >
        <span className="flex items-baseline text-footnote font-semibold">
          <Heading className="h-4 w-4" />
          {headingLevel ?? ""}
        </span>
      </ToolButton>
      <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => c().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-separator" />
      <ToolButton label="Checklist" active={editor.isActive("taskList")} onClick={() => c().toggleTaskList().run()}>
        <ListTodo className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => c().toggleCodeBlock().run()}>
        <Code2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Divider" onClick={() => c().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-separator" />
      <ToolButton label="Undo" onClick={() => c().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Redo" onClick={() => c().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}

/** Keeps the toolbar pinned just above the on-screen keyboard using visualViewport. */
function KeyboardToolbar({ editor }: { editor: Editor }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return (
    <div className="fixed inset-x-2 z-[55] flex items-center gap-2" style={{ bottom: offset + 8 }}>
      <Toolbar editor={editor} className="glass min-w-0 flex-1 rounded-full px-1.5" />
      <SheetIconButton kind="confirm" label="Done editing" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.commands.blur()} className="h-11 w-11 shrink-0" />
    </div>
  );
}

function MoveSheet({ open, onOpenChange, page, spaces, onBeforeSave }: { open: boolean; onOpenChange: (o: boolean) => void; page: KbPage; spaces: KbSpace[]; onBeforeSave: () => Promise<void> }) {
  const { run } = useMutation();
  const [spaceId, setSpaceId] = useState(page.spaceId);
  const [parentId, setParentId] = useState(page.parentId ?? "");
  const [candidates, setCandidates] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/kb/spaces/${spaceId}/pages`)
      .then((r) => r.json())
      .then((d: { pages?: { id: string; title: string }[] }) => setCandidates((d.pages ?? []).filter((p) => p.id !== page.id)))
      .catch(() => setCandidates([]));
  }, [open, spaceId, page.id]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Move Page"
      submitLabel="Move"
      size="auto"
      onSubmit={async () => {
        await onBeforeSave();
        return !!(await run(`/api/kb/pages/${page.id}`, { method: "PATCH", body: { spaceId, parentId }, success: "Moved" }));
      }}
    >
      <ListSection footer="Sub-pages move along with this page.">
        <FieldRow label="Space">
          <Select
            value={spaceId}
            onChange={(e) => {
              setSpaceId(e.target.value);
              setParentId("");
            }}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Inside">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Top level</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || "Untitled"}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>
    </FormSheet>
  );
}

function LinkSheet({
  open,
  onOpenChange,
  page,
  links,
  canLinkCrm,
  onBeforeSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  page: KbPage;
  links: { clients: Option[]; projects: Option[]; deals: Option[] };
  canLinkCrm: boolean;
  onBeforeSave: () => Promise<void>;
}) {
  const { run } = useMutation();
  const [clientId, setClientId] = useState(page.clientId ?? "");
  const [projectId, setProjectId] = useState(page.projectId ?? "");
  const [dealId, setDealId] = useState(page.dealId ?? "");
  const select = (value: string, set: (v: string) => void, options: Option[]) => (
    <Select value={value} onChange={(e) => set(e.target.value)}>
      <option value="">None</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </Select>
  );
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Link Page"
      submitLabel="Done"
      size="auto"
      onSubmit={async () => {
        await onBeforeSave();
        const body = canLinkCrm ? { clientId, projectId, dealId } : { projectId };
        const ok = !!(await run(`/api/kb/pages/${page.id}`, { method: "PATCH", body, success: "Links updated" }));
        if (!ok) toast.error("Couldn't update links");
        return ok;
      }}
    >
      <ListSection footer="Linked pages show up on the client, project or deal they belong to.">
        {canLinkCrm && <FieldRow label="Client">{select(clientId, setClientId, links.clients)}</FieldRow>}
        <FieldRow label="Project">{select(projectId, setProjectId, links.projects)}</FieldRow>
        {canLinkCrm && <FieldRow label="Deal">{select(dealId, setDealId, links.deals)}</FieldRow>}
      </ListSection>
    </FormSheet>
  );
}
