"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export type SignaturePadHandle = {
  /** The drawing as a transparent PNG cropped to the ink, or null when empty. */
  toDataUrl: () => string | null;
  clear: () => void;
};

/**
 * Draw a signature with a finger, stylus or mouse. The drawing lives only in
 * this canvas: it's turned into an image for the PDF being issued and
 * thrown away (PRD addendum 1.2, section 5). Nothing is saved or sent on
 * its own.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void }>(function SignaturePad({ onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number; w: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  // A ref, so a new onChange each render doesn't reset the pad.
  const changed = useRef(onChange);
  changed.current = onChange;

  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#001D21";
    ctx.fillStyle = "#001D21";
    setEmpty(true);
    changed.current?.(true);
  }, []);

  useEffect(() => {
    setup();
    // The pad is cleared if the screen rotates: a stretched signature isn't one.
    const onResize = () => setup();
    window.addEventListener("orientationchange", onResize);
    return () => window.removeEventListener("orientationchange", onResize);
  }, [setup]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    // Pressure where the device reports it; a steady pen otherwise.
    const p = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: 1.2 + p * 2.2 };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const pt = point(e);
    last.current = pt;
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.w / 2, 0, Math.PI * 2);
    ctx.fill();
    if (empty) {
      setEmpty(false);
      changed.current?.(false);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const ctx = canvas.current!.getContext("2d")!;
    const events = "getCoalescedEvents" in e.nativeEvent ? (e.nativeEvent as PointerEvent).getCoalescedEvents() : [];
    const points = events.length ? events.map((ev) => point({ ...e, clientX: ev.clientX, clientY: ev.clientY, pressure: ev.pressure, pointerType: ev.pointerType } as React.PointerEvent)) : [point(e)];
    for (const pt of points) {
      const prev = last.current!;
      ctx.lineWidth = (prev.w + pt.w) / 2;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      last.current = pt;
    }
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  useImperativeHandle(ref, () => ({
    clear: setup,
    toDataUrl: () => {
      const c = canvas.current;
      if (!c || empty) return null;
      // Crop to the ink so the signature sits on the line in the PDF.
      const ctx = c.getContext("2d")!;
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
      let top = height, left = width, right = 0, bottom = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3]! > 8) {
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      if (right <= left || bottom <= top) return null;
      const pad = 6;
      const out = document.createElement("canvas");
      out.width = right - left + pad * 2;
      out.height = bottom - top + pad * 2;
      out.getContext("2d")!.drawImage(c, left - pad, top - pad, out.width, out.height, 0, 0, out.width, out.height);
      return out.toDataURL("image/png");
    },
  }));

  return (
    // data-vaul-no-drag: drawing mustn't drag the sheet down on a phone.
    <div className="relative" data-vaul-no-drag>
      <canvas
        ref={canvas}
        className="block h-44 w-full touch-none select-none rounded-xl bg-white"
        style={{ touchAction: "none" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        aria-label="Signature pad: draw your signature"
        role="img"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-5 bottom-10 border-b border-[#001D21]/40" />
      {empty && <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-subhead text-[#4A5F63]">Sign here</span>}
    </div>
  );
});
