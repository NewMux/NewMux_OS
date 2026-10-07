"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, NotebookPen, Repeat } from "lucide-react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { ListSection } from "@/components/ui/List";
import { EmptyState } from "@/components/ui/EmptyState";
import { MeetingSheet } from "@/components/work/WorkSheets";
import type { Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { addDaysYmd, formatDate, formatTime, relativeDay, toYmd, todayYmd } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { MeetingListItem } from "@/lib/data/meetings";

/** Agenda view with a week strip, like Calendar's list mode. */
/** "Today · 23 Sep", "Saturday · 26 Sep", or "Monday 5 Oct" further out. */
function dayHeader(day: string) {
  const rel = relativeDay(day);
  const date = formatDate(day, { day: "numeric", month: "short" });
  return rel === date ? formatDate(day, { weekday: "long", day: "numeric", month: "short" }) : `${rel} · ${date}`;
}

export function CalendarScreen({ meetings, projects, clients }: { meetings: MeetingListItem[]; projects: Option[]; clients: Option[] }) {
  const router = useRouter();
  const { run, pending } = useMutation();
  const today = todayYmd();
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<MeetingListItem | null | "new">(null);
  const [showPast, setShowPast] = useState(false);
  useNewParam(() => setEditing("new"));

  // Week strip: Monday → Sunday around the selected day.
  const week = useMemo(() => {
    const d = new Date(`${selected}T12:00:00Z`);
    const monday = addDaysYmd(selected, -((d.getUTCDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
  }, [selected]);

  const byDay = useMemo(() => {
    const m = new Map<string, MeetingListItem[]>();
    for (const mt of meetings) {
      const day = toYmd(mt.startsAt);
      m.set(day, [...(m.get(day) ?? []), mt]);
    }
    return m;
  }, [meetings]);

  const days = [...byDay.keys()].sort();
  const upcoming = days.filter((d) => d >= selected);
  const past = days.filter((d) => d < today).reverse();

  const openNotes = async (m: MeetingListItem) => {
    const res = await run<{ pageId: string }>(`/api/meetings/${m.id}/notes`, { refresh: false });
    if (res) router.push(`/wiki/${res.pageId}`);
  };

  const dayGroup = (day: string) => (
    <ListSection key={day} header={<span className={day === today ? "text-ios-red" : undefined}>{dayHeader(day)}</span>}>
      {byDay.get(day)!.map((m) => (
        <div key={m.id} className="flex items-stretch gap-3 pl-4 [&:last-child_.row-sep]:shadow-none">
          <span className="my-2.5 w-1 shrink-0 rounded-full bg-ios-red" />
          <div role="button" tabIndex={0} onClick={() => setEditing(m)} onKeyDown={(e) => e.key === "Enter" && setEditing(m)} className="row-sep flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pr-3 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
            <div className="w-12 shrink-0 text-subhead tabular">
              <div className="font-semibold">{formatTime(m.startsAt)}</div>
              <div className="text-label-2">{m.durationMinutes}m</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-body font-medium">
                <span className="truncate">{m.title}</span>
                {m.recurring !== "none" && <Repeat className="h-3.5 w-3.5 shrink-0 text-label-3" />}
              </div>
              <div className="flex items-center gap-1 truncate text-subhead text-label-2">
                {m.location && <MapPin className="h-3 w-3 shrink-0" />}
                <span className="truncate">{[m.location, m.clientName ?? m.projectName].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                void openNotes(m);
              }}
              className={cn("press flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-footnote font-semibold", m.kbPageId ? "bg-ios-yellow/20 text-[#9a7b00] dark:text-ios-yellow" : "bg-fill/[0.12] text-accent")}
            >
              <NotebookPen className="h-3.5 w-3.5" />
              Notes
            </button>
          </div>
        </div>
      ))}
    </ListSection>
  );

  return (
    <Page
      title="Calendar"
      back={{ href: "/work", label: "Work" }}
      actions={
        <QuickAddMenu extra={[{ label: "New event", onSelect: () => setEditing("new") }]} />
      }
      accessory={
        <div className="grid grid-cols-7 gap-1 rounded-card bg-bg-elevated p-2">
          {week.map((d) => {
            const isSel = d === selected;
            const isToday = d === today;
            return (
              <button key={d} type="button" onClick={() => setSelected(d)} className="flex flex-col items-center gap-1 py-1">
                <span className="text-caption2 font-semibold uppercase text-label-2">{formatDate(d, { weekday: "narrow" })}</span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-body tabular",
                    isSel ? (isToday ? "bg-ios-red font-semibold text-white" : "bg-label font-semibold text-bg") : isToday ? "font-semibold text-ios-red" : "",
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                <span className={cn("h-1 w-1 rounded-full", byDay.has(d) ? "bg-label-3" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      }
    >
      <div className="mx-auto max-w-2xl">
        {upcoming.length === 0 && <EmptyState icon={CalendarDays} title="No upcoming events" message="Add client meetings and internal syncs with the + button." />}
        {upcoming.map(dayGroup)}
        {past.length > 0 && (
          <>
            <button type="button" onClick={() => setShowPast((s) => !s)} className="mb-3 px-4 text-subhead text-accent">
              {showPast ? "Hide past events" : "Show past 30 days"}
            </button>
            {showPast && past.map(dayGroup)}
          </>
        )}
      </div>
      <MeetingSheet meeting={editing && editing !== "new" ? editing : undefined} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} projects={projects} clients={clients} />
    </Page>
  );
}
