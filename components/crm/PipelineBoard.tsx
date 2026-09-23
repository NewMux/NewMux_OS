"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock } from "lucide-react";
import { Menu } from "@/components/ui/Menu";
import { useMutation } from "@/lib/useMutation";
import { DEAL_STAGE } from "@/lib/labels";
import { DEAL_STAGES, type DealStage } from "@/lib/data/types";
import type { DealListItem } from "@/lib/data/crm";
import { centsToDisplay, compactMoney, convertMinorUnits } from "@/lib/money";
import { formatDate, daysUntil } from "@/lib/time";
import { solidBg } from "@/lib/colors";
import { cn } from "@/lib/utils";

/**
 * Deals board. Drag cards between stages (mouse, or long-press on touch —
 * like lifting an icon on iPhone); every card also has a "Move to…" menu.
 */
export function PipelineBoard({ deals: initial }: { deals: DealListItem[] }) {
  const [deals, setDeals] = useState(initial);
  const [dragging, setDragging] = useState<DealListItem | null>(null);
  const { run } = useMutation();
  useEffect(() => setDeals(initial), [initial]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = useMemo(() => {
    const map = new Map<DealStage, DealListItem[]>(DEAL_STAGES.map((s) => [s, []]));
    for (const d of deals) map.get(d.stage)!.push(d);
    return map;
  }, [deals]);

  const move = async (deal: DealListItem, stage: DealStage) => {
    if (deal.stage === stage) return;
    setDeals((ds) => ds.map((d) => (d.id === deal.id ? { ...d, stage } : d)));
    if ("vibrate" in navigator) navigator.vibrate?.(8);
    const ok = await run(`/api/deals/${deal.id}/stage`, {
      body: { stage },
      success: stage === "won" ? "🎉 Deal won" : `Moved to ${DEAL_STAGE[stage].label}`,
    });
    if (!ok) setDeals(initial);
  };

  const onDragStart = (e: DragStartEvent) => setDragging(deals.find((d) => d.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const deal = deals.find((d) => d.id === e.active.id);
    const stage = e.over?.id as DealStage | undefined;
    if (deal && stage) void move(deal, stage);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="no-scrollbar snap-x-mandatory -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        {DEAL_STAGES.map((stage) => (
          <Column key={stage} stage={stage} deals={byStage.get(stage)!} onMove={move} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.32,0.72,0,1)" }}>
        {dragging && <DealCard deal={dragging} lifted />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ stage, deals, onMove }: { stage: DealStage; deals: DealListItem[]; onMove: (d: DealListItem, s: DealStage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const meta = DEAL_STAGE[stage];
  const total = deals.reduce((s, d) => s + convertMinorUnits(d.valueCents, d.currency, "BHD"), 0);
  const closed = stage === "won" || stage === "lost";
  const shown = closed ? deals.slice(0, 12) : deals;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[82vw] max-w-[300px] shrink-0 snap-center flex-col rounded-[18px] p-2 transition-colors md:w-[272px]",
        isOver ? "bg-accent/10 ring-2 ring-accent/40" : "bg-fill/[0.08]",
      )}
    >
      <header className="flex items-center gap-2 px-2 pb-2 pt-1">
        <span className={cn("h-2.5 w-2.5 rounded-full", solidBg[meta.color])} />
        <h2 className="text-headline">{meta.label}</h2>
        <span className="text-subhead text-label-2">{deals.length}</span>
        <span className="ml-auto text-footnote text-label-2 tabular">{compactMoney(total)}</span>
      </header>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2">
        {shown.map((d) => (
          <DraggableCard key={d.id} deal={d} onMove={onMove} />
        ))}
        {deals.length === 0 && <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-separator py-8 text-footnote text-label-3">Drop deals here</div>}
      </div>
    </section>
  );
}

function DraggableCard({ deal, onMove }: { deal: DealListItem; onMove: (d: DealListItem, s: DealStage) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-30")}>
      <DealCard deal={deal} onMove={onMove} />
    </div>
  );
}

function DealCard({ deal, lifted, onMove }: { deal: DealListItem; lifted?: boolean; onMove?: (d: DealListItem, s: DealStage) => void }) {
  const closeIn = deal.expectedClose ? daysUntil(deal.expectedClose) : null;
  const open = deal.stage !== "won" && deal.stage !== "lost";
  return (
    <div className={cn("group relative rounded-[14px] bg-bg-elevated p-3 transition-transform", lifted && "rotate-[1.5deg] scale-[1.03] shadow-float")}>
      <Link href={`/crm/deals/${deal.id}`} className="block md:pr-7" draggable={false}>
        <div className="text-body font-medium leading-snug">{deal.title}</div>
        <div className="mt-0.5 truncate text-subhead text-label-2">{deal.clientName ?? deal.contactName ?? "New prospect"}</div>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="font-rounded text-headline tabular">{centsToDisplay(deal.valueCents, deal.currency)}</span>
          {open && closeIn !== null && (
            <span className={cn("ml-auto flex items-center gap-1 text-caption1", closeIn < 0 ? "text-ios-red" : "text-label-2")}>
              <CalendarClock className="h-3 w-3" />
              {formatDate(deal.expectedClose, { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </Link>
      {onMove && (
        // Keyboard / mouse alternative to dragging; appears on hover or focus (phones use the deal screen's stepper).
        <div className="absolute right-1.5 top-1.5 hidden opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:block" onPointerDown={(e) => e.stopPropagation()}>
          <Menu
            label={`Move ${deal.title}`}
            trigger={
              <button type="button" aria-label="Move to stage" className="flex h-7 w-7 items-center justify-center rounded-full text-label-3 hover:bg-fill/10">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <circle cx="3" cy="8" r="1.4" />
                  <circle cx="8" cy="8" r="1.4" />
                  <circle cx="13" cy="8" r="1.4" />
                </svg>
              </button>
            }
            items={DEAL_STAGES.filter((s) => s !== deal.stage).map((s) => ({ label: `Move to ${DEAL_STAGE[s].label}`, onSelect: () => onMove(deal, s) }))}
          />
        </div>
      )}
    </div>
  );
}
