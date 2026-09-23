/** Activity-ring style progress (0–1). */
export function ProgressRing({ value, size = 28, stroke = 3.5, color = "rgb(var(--blue))" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      {/* Fitness-style: the track is the ring's own colour, faded. */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.32,0.72,0,1)" }}
      />
    </svg>
  );
}
