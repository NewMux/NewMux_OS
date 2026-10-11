import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ArrowUp, ChevronDown, Sparkles } from "lucide-react";

// NEWMUX OS dark-mode tokens (app/globals.css)
export const C = {
  bg: "rgb(0 0 0)",
  elevated: "rgb(28 28 30)",
  elevated2: "rgb(44 44 46)",
  label: "rgb(255 255 255)",
  label2: "rgb(168 168 175)",
  label3: "rgb(118 118 124)",
  separator: "rgb(56 56 58)",
  fill: "rgba(118, 118, 128, 0.24)",
  blue: "rgb(10 132 255)",
  green: "rgb(48 209 88)",
  red: "rgb(255 69 58)",
  orange: "rgb(255 159 10)",
  indigo: "rgb(94 92 230)",
  purple: "rgb(191 90 242)",
};

export const FONT = `-apple-system, "SF Pro Display", "Inter Variable", Inter, system-ui, sans-serif`;

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 progress between two frames with the house ease. */
export const prog = (frame: number, start: number, dur = 18) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: EASE });

/** Fade and rise in at `start`. */
export const rise = (frame: number, start: number, dist = 40, dur = 22): React.CSSProperties => {
  const p = prog(frame, start, dur);
  return { opacity: p, translate: `0px ${(1 - p) * dist}px` };
};

/** Characters of `text` typed from `start` at `cps` chars per frame. */
export const typed = (text: string, frame: number, start: number, cps = 0.9) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));

/** Black stage with two slow-drifting colour glows. */
export const Backdrop: React.FC<{ hue?: "blue" | "purple"; intensity?: number }> = ({ hue = "blue", intensity = 1 }) => {
  const f = useCurrentFrame();
  const a = hue === "blue" ? "10,132,255" : "191,90,242";
  const b = hue === "blue" ? "94,92,230" : "10,132,255";
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          left: -300 + Math.sin(f / 70) * 80,
          top: -700 + Math.cos(f / 90) * 60,
          background: `radial-gradient(circle, rgba(${a},${0.22 * intensity}) 0%, rgba(${a},0) 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 1300,
          right: -400 + Math.cos(f / 80) * 80,
          bottom: -800 + Math.sin(f / 60) * 60,
          background: `radial-gradient(circle, rgba(${b},${0.2 * intensity}) 0%, rgba(${b},0) 60%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** iOS 26 dark glass: translucent, blurred, specular top edge. */
export const glass: React.CSSProperties = {
  background: "rgba(38, 38, 40, 0.72)",
  backdropFilter: "blur(40px) saturate(180%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.16), 0 0 0 1px rgba(255,255,255,0.1), 0 30px 80px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)",
};

/** Haman's four-point spark, gradient filled. */
export const Spark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <defs>
      <linearGradient id="spark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#64D2FF" />
        <stop offset="50%" stopColor="#0A84FF" />
        <stop offset="100%" stopColor="#BF5AF2" />
      </linearGradient>
    </defs>
    <path d="M50 0 C54 34 66 46 100 50 C66 54 54 66 50 100 C46 66 34 54 0 50 C34 46 46 34 50 0Z" fill="url(#spark)" />
    <path d="M82 6 C83.5 14 86 16.5 94 18 C86 19.5 83.5 22 82 30 C80.5 22 78 19.5 70 18 C78 16.5 80.5 14 82 6Z" fill="url(#spark)" />
  </svg>
);

/** Big kinetic headline + sub for the left column of UI scenes. */
export const Caption: React.FC<{ eyebrow?: string; title: string; sub: string; start?: number }> = ({ eyebrow, title, sub, start = 0 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 140, top: 0, bottom: 0, width: 640, display: "flex", flexDirection: "column", justifyContent: "center", fontFamily: FONT }}>
      {eyebrow && (
        <div style={{ ...rise(f, start, 30), color: C.blue, fontSize: 30, fontWeight: 600, letterSpacing: 0.5, marginBottom: 18 }}>{eyebrow}</div>
      )}
      <div style={{ ...rise(f, start + 4, 40), color: C.label, fontSize: 96, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>{title}</div>
      <div style={{ ...rise(f, start + 12, 40), color: C.label2, fontSize: 42, fontWeight: 500, lineHeight: 1.25, marginTop: 28, letterSpacing: -0.5 }}>{sub}</div>
    </div>
  );
};

/** Haman's chat panel as it looks on iPad/Mac (scaled up for video). */
export const ChatPanel: React.FC<{ children: React.ReactNode; enter?: number; composer?: string }> = ({ children, enter = 0, composer }) => {
  const f = useCurrentFrame();
  const p = prog(f, enter, 26);
  return (
    <div
      style={{
        position: "absolute",
        right: 120,
        top: 70,
        bottom: 70,
        width: 900,
        borderRadius: 48,
        background: C.bg,
        boxShadow: "0 0 0 1.5px rgba(255,255,255,0.12), 0 40px 120px rgba(0,0,0,0.7), 0 0 160px rgba(10,132,255,0.12)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT,
        opacity: p,
        translate: `${(1 - p) * 220}px 0px`,
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "34px 40px 22px", borderBottom: `1.5px solid ${C.separator}` }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, background: "rgba(10,132,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles color={C.blue} size={34} />
        </div>
        <div>
          <div style={{ color: C.label, fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>Haman</div>
          <div style={{ color: C.label2, fontSize: 24, display: "flex", alignItems: "center", gap: 6 }}>
            Opus 5.5 · Balanced <ChevronDown size={22} />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "30px 36px", display: "flex", flexDirection: "column", gap: 22, overflow: "hidden" }}>{children}</div>
      {/* composer */}
      <div style={{ padding: "18px 30px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 40, background: C.fill, padding: "12px 12px 12px 32px" }}>
          <div style={{ flex: 1, fontSize: 30, color: composer ? C.label : C.label3 }}>{composer || "Ask Haman…"}</div>
          <div style={{ width: 58, height: 58, borderRadius: 29, background: composer ? C.blue : "rgba(118,118,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowUp color="white" size={32} strokeWidth={2.6} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const UserBubble: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 16);
  return (
    <div style={{ alignSelf: "flex-end", maxWidth: "82%", opacity: p, scale: `${0.9 + 0.1 * p}`, transformOrigin: "bottom right" }}>
      <div style={{ background: C.blue, color: "white", fontSize: 31, padding: "18px 28px", borderRadius: "36px 36px 10px 36px" }}>{text}</div>
    </div>
  );
};

/** Grey "Looking up …" status bubble with a moving shimmer. */
export const Status: React.FC<{ text: string; from: number; to: number }> = ({ text, from, to }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const shimmer = ((f - from) * 18) % 600;
  return (
    <div style={{ ...rise(f, from, 14, 12), alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 14, background: C.elevated, borderRadius: "36px 36px 36px 10px", padding: "18px 28px", fontSize: 28 }}>
      <Sparkles color={C.blue} size={28} />
      <span
        style={{
          backgroundImage: `linear-gradient(90deg, ${C.label2} 0%, ${C.label2} ${shimmer / 6 - 20}%, white ${shimmer / 6}%, ${C.label2} ${shimmer / 6 + 20}%, ${C.label2} 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {text}
      </span>
    </div>
  );
};

/** Assistant bubble whose children appear line by line from `at`. */
export const Reply: React.FC<{ at: number; lines: React.ReactNode[]; every?: number }> = ({ at, lines, every = 7 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  return (
    <div style={{ ...rise(f, at, 14, 12), alignSelf: "flex-start", maxWidth: "94%", background: C.elevated, borderRadius: "36px 36px 36px 10px", padding: "24px 30px", color: C.label, fontSize: 30, lineHeight: 1.4 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ ...rise(f, at + i * every, 10, 12) }}>
          {l}
        </div>
      ))}
    </div>
  );
};

export const Link: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: C.blue, fontWeight: 500 }}>{children}</span>;
export const B: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ fontWeight: 650 }}>{children}</span>;
