"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

/**
 * Discoverability for ⌘K. Dispatches the same keyboard event the palette
 * already listens for, rather than lifting its open state into a context —
 * one listener, one source of truth.
 */
export function CommandPaletteTrigger() {
  const [modifier, setModifier] = useState("Ctrl");

  useEffect(() => {
    // navigator is client-only, and the label must not differ between the
    // server render and the first paint.
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setModifier("⌘");
  }, []);

  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true }),
        )
      }
      aria-label="Open the command palette"
      className="flex min-h-[32px] items-center gap-2 rounded-lg border border-input bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Search className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden rounded border border-border px-1 font-sans text-[10px] sm:inline">
        {modifier === "⌘" ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
