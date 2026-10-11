import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, C, FONT, Spark, rise } from "../kit";

const WORDS = ["Ask.", "Confirm.", "Done."];

export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 2, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop hue="purple" intensity={0.9} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, scale: `${0.85 + 0.15 * s}`, opacity: s }}>
          <Spark size={150} style={{ filter: "drop-shadow(0 0 50px rgba(10,132,255,0.55))", rotate: `${Math.sin(f / 30) * 5}deg` }} />
          <span style={{ color: C.label, fontSize: 170, fontWeight: 800, letterSpacing: -6 }}>Haman</span>
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 40 }}>
          {WORDS.map((w, i) => (
            <span key={w} style={{ ...rise(f, 22 + i * 10, 30, 20), fontSize: 64, fontWeight: 650, letterSpacing: -1.5, color: i === 2 ? C.blue : C.label }}>
              {w}
            </span>
          ))}
        </div>
        <div style={{ ...rise(f, 64, 20, 24), marginTop: 70, color: C.label2, fontSize: 34, fontWeight: 500, letterSpacing: 4 }}>
          NOW IN <span style={{ color: C.label, fontWeight: 700 }}>NEWMUX OS</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
