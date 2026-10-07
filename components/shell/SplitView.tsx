"use client";

import { createContext } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";
import { SplitListContext, SplitPaneContext } from "@/components/ui/Page";

/** True when the list has the whole width (iPad landscape/Mac, nothing selected): show it as a table. */
export const SplitWideContext = createContext(false);

/**
 * Mail/Notes-style list → detail split view for iPad (landscape) and Mac.
 * The list column stays put while the detail pane changes. On narrower
 * screens it behaves like a phone: the list, or the selected item.
 * Used from a route's layout.tsx; the index page renders nothing.
 *
 * With `wideWhenEmpty`, the list takes the full width until something is
 * opened, instead of sitting beside an empty "nothing selected" pane.
 */
export function SplitView({
  list,
  children,
  placeholder,
  wideWhenEmpty,
}: {
  list: React.ReactNode;
  children: React.ReactNode;
  /** Shown in the detail pane when nothing is selected (iPad/Mac only), e.g. an EmptyState. */
  placeholder: React.ReactNode;
  wideWhenEmpty?: boolean;
}) {
  const hasDetail = useSelectedLayoutSegment() !== null;
  const wide = !!wideWhenEmpty && !hasDetail;
  return (
    <div className="lg:flex lg:h-dvh">
      <div
        className={cn(
          "lg:overflow-y-auto",
          wide ? "lg:flex-1" : "lg:w-[380px] lg:shrink-0 lg:border-r-[0.5px] lg:border-separator",
          hasDetail && "hidden lg:block",
        )}
      >
        <SplitListContext.Provider value={!wide}>
          <SplitWideContext.Provider value={wide}>{list}</SplitWideContext.Provider>
        </SplitListContext.Provider>
      </div>
      {!wide && (
        <div className={cn("min-w-0 flex-1 lg:overflow-y-auto", !hasDetail && "hidden lg:block")}>
          <SplitPaneContext.Provider value={true}>
            {hasDetail ? (
              children
            ) : (
              <div className="flex h-full items-center justify-center">{placeholder}</div>
            )}
          </SplitPaneContext.Provider>
        </div>
      )}
    </div>
  );
}
