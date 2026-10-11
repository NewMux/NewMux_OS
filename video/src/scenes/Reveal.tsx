import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, C, FONT, Spark, rise } from "../kit";

export const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 14, mass: 0.9 } });
  const glow = interpolate(f, [0, 30, 120], [0, 1, 0.75], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop hue="purple" intensity={glow} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "absolute",
            width: 900,
            height: 900,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(10,132,255,0.35) 0%, rgba(191,90,242,0.15) 35%, rgba(0,0,0,0) 65%)",
            scale: `${0.3 + glow * 0.9}`,
            translate: "0px -150px",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", translate: "0px -10px" }}>
          <Spark size={220} style={{ scale: `${s}`, rotate: `${(1 - s) * -120 + Math.sin(f / 25) * 4}deg`, filter: "drop-shadow(0 0 60px rgba(10,132,255,0.6))" }} />
          <div style={{ ...rise(f, 20, 50, 26), color: C.label, fontSize: 168, fontWeight: 800, letterSpacing: -6, marginTop: 30 }}>
            Meet Haman.
          </div>
          <div style={{ ...rise(f, 34, 30, 26), color: C.label2, fontSize: 50, fontWeight: 500, letterSpacing: -1, marginTop: 6 }}>
            Your AI project manager, inside <span style={{ color: C.label }}>NEWMUX OS</span>.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
