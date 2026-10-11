"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Palette } from "lucide-react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpaceIcon } from "@/components/wiki/SpaceIcon";
import { CATEGORY_LABEL, FileSheet, formatBytes } from "@/components/files/FileSheet";
import type { Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { useNewParam } from "@/lib/hooks/useNewParam";
import type { FileListItem } from "@/lib/data/files";
import type { KbPageSummary, KbSpace } from "@/lib/data/types";

/**
 * Brand & Assets: logos, brand identity files and marketing assets (Files,
 * categories Brand and Marketing), and the brand guide in the wiki.
 */
export function BrandScreen({
  files,
  space,
  pages,
  clients,
  projects,
  ventures,
}: {
  files: FileListItem[];
  space: KbSpace | null;
  pages: KbPageSummary[];
  clients: Option[];
  projects: Option[];
  ventures: Option[];
}) {
  const router = useRouter();
  const { run } = useMutation();
  const [editing, setEditing] = useState<FileListItem | "new" | null>(null);
  useNewParam(() => setEditing("new"));
  const brand = files.filter((f) => f.category === "brand");
  const assets = files.filter((f) => f.category === "marketing");

  const fileRow = (f: FileListItem) => (
    <ListRow
      key={f.id}
      onClick={() => setEditing(f)}
      leading={<IconTile icon={f.contentType.startsWith("image/") ? ImageIcon : FileText} color={f.category === "brand" ? "purple" : "pink"} />}
      title={f.name}
      subtitle={[f.ventureName ?? f.projectName ?? f.clientName, formatBytes(f.sizeBytes)].filter(Boolean).join(" · ")}
    />
  );

  const createSpace = async () => {
    const res = await run<{ space: { id: string } }>("/api/kb/spaces", { body: { name: "Brand", description: "Brand guide: voice, colours, logos and how to use them.", icon: "megaphone", color: "pink" }, success: "Brand space created" });
    if (res) router.push(`/wiki/s/${res.space.id}`);
  };

  return (
    <Page title="Brand & Assets" back={{ href: "/marketing", label: "Marketing" }} actions={<QuickAddMenu extra={[{ label: "Upload asset", onSelect: () => setEditing("new") }]} />}>
      <div className="mx-auto max-w-2xl">
        <ListSection header="Brand guide" info="Pages in the wiki space named Brand (or Marketing).">
          {space ? (
            <>
              <ListRow href={`/wiki/s/${space.id}`} leading={<SpaceIcon icon={space.icon} color={space.color} />} title={space.name} subtitle={space.description ?? `${pages.length} pages`} />
              {pages.slice(0, 8).map((p) => (
                <ListRow key={p.id} href={`/wiki/${p.id}`} leading={<span className="w-[30px] text-center text-[20px]">{p.emoji ?? "📄"}</span>} title={p.title || "Untitled"} />
              ))}
            </>
          ) : (
            <ListRow leading={<IconTile icon={Palette} color="pink" />} title={<span className="text-accent">Start a brand guide in the wiki</span>} subtitle="Creates a Brand space for voice, colours and logo rules" onClick={() => void createSpace()} multiline />
          )}
        </ListSection>

        {files.length === 0 ? (
          <EmptyState icon={ImageIcon} title="No assets yet" message="Upload logos, the brand book, templates and post images. Everyone on the team can open them here." action={<Button onClick={() => setEditing("new")}>Upload</Button>} />
        ) : (
          <>
            {brand.length > 0 && <ListSection header={CATEGORY_LABEL.brand}>{brand.map(fileRow)}</ListSection>}
            {assets.length > 0 && <ListSection header="Marketing assets">{assets.map(fileRow)}</ListSection>}
          </>
        )}
      </div>
      <FileSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        file={editing && editing !== "new" ? editing : undefined}
        clients={clients}
        projects={projects}
        ventures={ventures}
        categories={["marketing", "brand"]}
      />
    </Page>
  );
}
