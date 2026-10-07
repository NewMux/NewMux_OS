"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { downloadPdf } from "@/lib/pdf/download";

/** A link-styled button that builds the PDF in the browser and downloads it. */
export function PdfDownloadLink({ dataUrl, className, children }: { dataUrl: string; className?: string; children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadPdf(dataUrl);
        } catch (error) {
          toast.error((error as Error).message || "Couldn't create the PDF.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </button>
  );
}
