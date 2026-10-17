"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * A PDF drawn page by page with pdf.js, so the A4 preview looks the same on
 * an iPhone as on a Mac (Safari only shows a PDF's first page in a frame).
 * pdf.js and its worker load only when a preview opens.
 */
export function PdfPreview({ blob, className }: { blob: Blob | null; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!blob || !host.current) return;
    let cancelled = false;
    const el = host.current;
    setState("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/doc/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled) return;
        el.replaceChildren();
        const width = el.clientWidth || 600;
        const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.className = "mb-3 bg-white shadow-[0_1px_4px_rgb(0_0_0/0.18)] last:mb-0";
          canvas.setAttribute("aria-label", `Page ${n} of ${doc.numPages}`);
          el.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        }
        if (!cancelled) setState("ready");
      } catch (error) {
        console.error("[preview]", error);
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  return (
    <div className={className}>
      {(!blob || state === "loading") && <Skeleton className="aspect-[210/297] w-full rounded-none" />}
      {state === "failed" && <p className="py-10 text-center text-subhead text-label-2">The preview couldn&apos;t be drawn. Download the PDF to see it.</p>}
      <div ref={host} className={state === "ready" ? "" : "h-0 overflow-hidden"} />
    </div>
  );
}
