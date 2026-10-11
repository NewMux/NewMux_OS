"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronRight, Lightbulb } from "lucide-react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PostSheet, type PostDefaults } from "@/components/marketing/MarketingSheets";
import type { Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { POST_CHANNEL, POST_STATUS } from "@/lib/labels";
import { POST_STATUSES, type PostStatus } from "@/lib/marketing";
import type { MarketingPost } from "@/lib/data/marketing";
import { formatDate, formatTime, relativeDay, toYmd, todayYmd } from "@/lib/time";
import { cn } from "@/lib/utils";
import { solidBg } from "@/lib/colors";

const NEXT: Partial<Record<PostStatus, PostStatus>> = { idea: "drafting", drafting: "review", review: "scheduled", scheduled: "published" };

function dayHeader(day: string) {
  const rel = relativeDay(day);
  const date = formatDate(day, { day: "numeric", month: "short" });
  return rel === date ? formatDate(day, { weekday: "long", day: "numeric", month: "short" }) : `${rel} · ${date}`;
}

/** The content calendar: what's going out when (Calendar), and where each post is up to (Board). */
export function ContentScreen({ posts, campaigns, users, assets }: { posts: MarketingPost[]; campaigns: Option[]; users: Option[]; assets: Option[] }) {
  const { run } = useMutation();
  const [view, setView] = useState<"calendar" | "board">("calendar");
  const [editing, setEditing] = useState<{ post?: MarketingPost; defaults?: PostDefaults } | null>(null);
  useNewParam(() => setEditing({}));
  const today = todayYmd();

  const { byDay, ideas } = useMemo(() => {
    const m = new Map<string, MarketingPost[]>();
    const undated: MarketingPost[] = [];
    for (const p of posts) {
      if (!p.publishAt) undated.push(p);
      else {
        const day = toYmd(p.publishAt);
        m.set(day, [...(m.get(day) ?? []), p]);
      }
    }
    return { byDay: m, ideas: undated };
  }, [posts]);
  const days = [...byDay.keys()].sort();
  const upcoming = days.filter((d) => d >= today);
  const recent = days.filter((d) => d < today).reverse();

  const advance = (p: MarketingPost) => {
    const next = NEXT[p.status];
    if (next) void run(`/api/marketing/posts/${p.id}/status`, { body: { status: next }, success: `${POST_STATUS[next].label}` });
  };

  const row = (p: MarketingPost) => (
    <ListRow
      key={p.id}
      onClick={() => setEditing({ post: p })}
      leading={<span className={cn("h-9 w-1 shrink-0 rounded-full", solidBg[POST_CHANNEL[p.channel].color])} aria-hidden />}
      title={p.title}
      subtitle={[p.publishAt ? formatTime(p.publishAt) : null, POST_CHANNEL[p.channel].label, p.ownerName, p.campaignName].filter(Boolean).join(" · ")}
      trailing={<Badge color={POST_STATUS[p.status].color}>{POST_STATUS[p.status].label}</Badge>}
    />
  );

  return (
    <Page
      title="Content"
      back={{ href: "/marketing", label: "Marketing" }}
      wide={view === "board"}
      accessory={
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "calendar", label: "Calendar" },
            { value: "board", label: "Board" },
          ]}
        />
      }
      actions={<QuickAddMenu extra={[{ label: "New post", onSelect: () => setEditing({}) }]} />}
    >
      {view === "calendar" ? (
        <div className="mx-auto max-w-2xl">
          {upcoming.length === 0 && ideas.length === 0 && (
            <EmptyState icon={CalendarRange} title="Nothing planned yet" message="Add a post with the date it goes out, or jot down an idea for later." />
          )}
          {upcoming.map((day) => (
            <ListSection key={day} header={<span className={day === today ? "text-ios-red" : undefined}>{dayHeader(day)}</span>}>
              {byDay.get(day)!.map(row)}
            </ListSection>
          ))}
          {ideas.length > 0 && (
            <ListSection header="Ideas · no date yet" action={<button className="text-subhead text-accent" onClick={() => setEditing({ defaults: { status: "idea" } })}>Add</button>}>
              {ideas.map(row)}
            </ListSection>
          )}
          {recent.length > 0 && (
            <ListSection header="Last 30 days">
              {recent.flatMap((d) => byDay.get(d)!).map(row)}
            </ListSection>
          )}
        </div>
      ) : (
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0">
          {POST_STATUSES.map((status) => {
            // The page loads the last 30 days, so Published only shows recent posts.
            const items = posts.filter((p) => p.status === status);
            return (
              <section key={status} className="flex w-[82vw] max-w-[300px] shrink-0 snap-center flex-col rounded-card bg-fill/[0.08] p-2 md:w-[260px]">
                <header className="flex items-center gap-2 px-2 pb-2 pt-1">
                  <span className={cn("h-2.5 w-2.5 rounded-full", solidBg[POST_STATUS[status].color])} />
                  <h2 className="text-headline">{POST_STATUS[status].label}</h2>
                  <span className="text-subhead text-label-2">{items.length}</span>
                  {status === "idea" && (
                    <button type="button" className="ml-auto text-subhead text-accent" onClick={() => setEditing({ defaults: { status: "idea" } })}>
                      Add
                    </button>
                  )}
                </header>
                <div className="flex min-h-[100px] flex-col gap-2">
                  {items.map((p) => (
                    <div key={p.id} className="group relative rounded-[16px] bg-bg-elevated p-3">
                      <button type="button" className="block w-full pr-7 text-left" onClick={() => setEditing({ post: p })}>
                        <div className="text-body font-medium leading-snug">{p.title}</div>
                        <div className="mt-0.5 truncate text-subhead text-label-2">
                          {[POST_CHANNEL[p.channel].label, p.publishAt ? formatDate(p.publishAt, { day: "numeric", month: "short" }) : null].filter(Boolean).join(" · ")}
                        </div>
                        {p.ownerName && <div className="mt-1.5 text-caption1 text-label-2">{p.ownerName}</div>}
                      </button>
                      {NEXT[p.status] && (
                        <button
                          type="button"
                          aria-label={`Move to ${POST_STATUS[NEXT[p.status]!].label}`}
                          title={`Move to ${POST_STATUS[NEXT[p.status]!].label}`}
                          onClick={() => advance(p)}
                          className="press absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-fill/[0.12] text-label-2 hover:text-label"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-separator py-8 text-footnote text-label-2">
                      {status === "idea" ? <Lightbulb className="h-4 w-4" /> : "Nothing here"}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <PostSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        post={editing?.post}
        defaults={editing?.defaults}
        campaigns={campaigns}
        users={users}
        assets={assets}
      />
    </Page>
  );
}
