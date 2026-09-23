"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";
import { SplitListContext, SplitPaneContext } from "@/components/ui/Page";

/**
 * Mail/Notes-style list → detail split view for iPad (landscape) and Mac.
 * The list column stays put while the detail pane changes. On narrower
 * screens it behaves like a phone: the list, or the selected item.
 * Used from a route's layout.tsx; the index page renders nothing.
 */
export function SplitView({
  list,
  children,
  placeholder,
}: {
  list: React.ReactNode;
  children: React.ReactNode;
  /** Shown in the detail pane when nothing is selected (iPad/Mac only), e.g. an EmptyState. */
  placeholder: React.ReactNode;
}) {
  const hasDetail = useSelectedLayoutSegment() !== null;
  return (
    <div className="lg:flex lg:h-dvh">
      <div className={cn("lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-r-[0.5px] lg:border-separator", hasDetail && "hidden lg:block")}>
        <SplitListContext.Provider value={true}>{list}</SplitListContext.Provider>
      </div>
      <div className={cn("min-w-0 flex-1 lg:overflow-y-auto", !hasDetail && "hidden lg:block")}>
        <SplitPaneContext.Provider value={true}>
          {hasDetail ? (
            children
          ) : (
            <div className="flex h-full items-center justify-center">{placeholder}</div>
          )}
        </SplitPaneContext.Provider>
      </div>
    </div>
  );
}
