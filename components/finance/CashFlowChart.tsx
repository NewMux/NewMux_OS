"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compactMoney, centsToDisplay } from "@/lib/money";
import type { CashFlowMonth } from "@/lib/data/reports";
import { cn } from "@/lib/utils";

const H = 168;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const Y_AXIS = 40;

/** Rounded-top column path (4px data-end, square at the baseline). */
function column(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Cash in vs out per month (BHD). Grouped columns, one baseline, one axis.
 * Tap/hover a month for its values; the list view below carries every number.
 */
export function CashFlowChart({ months }: { months: CashFlowMonth[] }) {
  const [active, setActive] = useState<number>(months.length - 1);
  const [width, setWidth] = useState(600);
  const [showTable, setShowTable] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = useMemo(() => niceMax(Math.max(...months.flatMap((m) => [m.inBhdCents, m.outBhdCents]), 1)), [months]);
  const plotW = Math.max(width - Y_AXIS, 100);
  const slot = plotW / months.length;
  const barW = Math.min(12, Math.max(4, (slot - 8) / 2));
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const cur = months[active];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-footnote text-label-2">Net cash · {cur?.label}</div>
          <div className="font-rounded text-title2 font-semibold tabular">{centsToDisplay((cur?.inBhdCents ?? 0) - (cur?.outBhdCents ?? 0), "BHD")}</div>
        </div>
        <div className="flex items-center gap-4 text-footnote text-label-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--chart-in)" }} />
            In {cur && <b className="font-semibold text-label tabular">{compactMoney(cur.inBhdCents)}</b>}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--chart-out)" }} />
            Out {cur && <b className="font-semibold text-label tabular">{compactMoney(cur.outBhdCents)}</b>}
          </span>
        </div>
      </div>

      <div ref={box} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Cash in and out per month, last 12 months">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={Y_AXIS} x2={width} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={Y_AXIS - 6} y={y(t) + 4} textAnchor="end" className="fill-label-2 text-[10px] tabular">
                {compactMoney(t, "BHD").replace("BHD ", "")}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = Y_AXIS + slot * i + slot / 2;
            const isActive = i === active;
            return (
              <g
                key={m.month}
                role="button"
                tabIndex={0}
                aria-label={`${m.label}: in ${centsToDisplay(m.inBhdCents, "BHD")}, out ${centsToDisplay(m.outBhdCents, "BHD")}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
                className="cursor-pointer outline-none"
              >
                <rect x={cx - slot / 2} y={0} width={slot} height={H} fill={isActive ? "rgb(var(--fill) / 0.08)" : "transparent"} rx={6} />
                <path d={column(cx - barW - 1, y(m.inBhdCents), barW, PAD_TOP + plotH - y(m.inBhdCents))} fill="var(--chart-in)" opacity={isActive ? 1 : 0.85} />
                <path d={column(cx + 1, y(m.outBhdCents), barW, PAD_TOP + plotH - y(m.outBhdCents))} fill="var(--chart-out)" opacity={isActive ? 1 : 0.85} />
                <text x={cx} y={H - 6} textAnchor="middle" className={cn("text-[10px]", isActive ? "fill-label font-semibold" : "fill-label-2")}>
                  {m.label.slice(0, 1)}
                  <tspan className="hidden sm:inline">{m.label.slice(1, 3)}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <button type="button" onClick={() => setShowTable((s) => !s)} className="mt-2 text-subhead text-accent">
        {showTable ? "Hide monthly breakdown" : "Show monthly breakdown"}
      </button>
      {showTable && (
        <table className="mt-2 w-full text-subhead tabular">
          <thead>
            <tr className="text-left text-footnote text-label-2">
              <th className="py-1 font-normal">Month</th>
              <th className="py-1 text-right font-normal">In</th>
              <th className="py-1 text-right font-normal">Out</th>
              <th className="py-1 text-right font-normal">Net</th>
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((m) => (
              <tr key={m.month} className="hairline-t">
                <td className="py-1.5">{m.month}</td>
                <td className="py-1.5 text-right">{centsToDisplay(m.inBhdCents, "BHD")}</td>
                <td className="py-1.5 text-right">{centsToDisplay(m.outBhdCents, "BHD")}</td>
                <td className={cn("py-1.5 text-right", m.inBhdCents - m.outBhdCents < 0 && "text-ios-red")}>
                  {centsToDisplay(m.inBhdCents - m.outBhdCents, "BHD")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
