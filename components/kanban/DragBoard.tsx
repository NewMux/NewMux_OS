"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

export type BoardItem = { id: string; columnId: string };

export type BoardColumn = {
  id: string;
  label: string;
  /** Rendered under the column heading — counts, totals, etc. */
  meta?: React.ReactNode;
};

function SortableCard({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function Column({
  column,
  itemIds,
  children,
}: {
  column: BoardColumn;
  itemIds: string[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    // Narrow screens scroll columns sideways like a real board; wide screens lay them out in a grid.
    <div className="w-[17rem] shrink-0 lg:w-auto">
      <div className="mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {column.label}
        </h3>
        {column.meta && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {column.meta}
          </div>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-col gap-2 rounded-xl border border-dashed p-2 transition-colors",
          isOver ? "border-primary/60 bg-success/5" : "border-border/60",
        )}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </div>
    </div>
  );
}

/**
 * Multi-column drag-and-drop board. Cards move within and between columns by
 * pointer, touch, or keyboard (space to lift, arrows to move). The parent owns
 * persistence: `onMove` fires once per drop with the card's final position.
 */
export function DragBoard<T extends BoardItem>({
  items: itemsProp,
  columns,
  onMove,
  renderCard,
}: {
  items: T[];
  columns: BoardColumn[];
  onMove: (
    itemId: string,
    toColumnId: string,
    index: number,
  ) => void | Promise<void>;
  renderCard: (item: T) => React.ReactNode;
}) {
  const [items, setItems] = useState(itemsProp);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-sync after the server refreshes (a move, an edit, a new card).
  useEffect(() => setItems(itemsProp), [itemsProp]);

  const sensors = useSensors(
    // A small activation distance keeps taps on buttons inside cards working.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const columnOf = (id: string): string | undefined => {
    if (columns.some((c) => c.id === id)) return id;
    return items.find((i) => i.id === id)?.columnId;
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  /** Live preview: pull the card into whichever column it is hovering over. */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeColumn = columnOf(String(active.id));
    const overColumn = columnOf(String(over.id));
    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    setItems((prev) =>
      prev.map((i) =>
        i.id === String(active.id) ? { ...i, columnId: overColumn } : i,
      ),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const targetColumn = columnOf(overId);
    if (!targetColumn) return;

    const column = items.filter((i) => i.columnId === targetColumn);
    const oldIndex = column.findIndex((i) => i.id === activeId);
    // Dropping on the column itself (not a card) appends to the end.
    const overIndex = column.findIndex((i) => i.id === overId);
    const newIndex = overIndex === -1 ? column.length - 1 : overIndex;

    if (oldIndex !== -1 && oldIndex !== newIndex) {
      const reordered = arrayMove(column, oldIndex, newIndex);
      setItems((prev) => [
        ...prev.filter((i) => i.columnId !== targetColumn),
        ...reordered,
      ]);
    }

    void onMove(activeId, targetColumn, Math.max(0, newIndex));
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div
        className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:overflow-x-visible"
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        }}
      >
        {columns.map((column) => {
          const columnItems = items.filter((i) => i.columnId === column.id);
          return (
            <Column
              key={column.id}
              column={column}
              itemIds={columnItems.map((i) => i.id)}
            >
              {columnItems.map((item) => (
                <SortableCard key={item.id} id={item.id}>
                  {renderCard(item)}
                </SortableCard>
              ))}
            </Column>
          );
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rotate-2 opacity-90 shadow-xl">
            {renderCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
