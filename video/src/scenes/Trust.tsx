import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Lock, ShieldCheck, UserCheck } from "lucide-react";
import { Backdrop, C, FONT, glass, rise } from "../kit";

const BEATS = [
  { Icon: ShieldCheck, color: C.green, title: "Never acts on his own.", sub: "Only your Confirm sends a change." },
  { Icon: UserCheck, color: C.blue, title: "Your permissions. Your audit log.", sub: "Every change runs as you, with the same rules." },
  { Icon: Lock, color: C.orange, title: "Secrets stay on your screen.", sub: "Vault values never reach the model." },
];

export const Trust: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop hue="purple" intensity={0.7} />
      <div style={{ position: "absolute", top: 130, left: 0, right: 0, textAlign: "center", ...rise(f, 0, 30) }}>
        <div style={{ color: C.label, fontSize: 92, fontWeight: 700, letterSpacing: -3 }}>Built to be trusted.</div>
      </div>
      <div style={{ position: "absolute", top: 380, left: 160, right: 160, display: "flex", gap: 40 }}>
        {BEATS.map(({ Icon, color, title, sub }, i) => (
          <div key={title} style={{ ...glass, ...rise(f, 24 + i * 28, 60, 26), flex: 1, borderRadius: 44, padding: "56px 48px", minHeight: 440 }}>
            <div style={{ width: 104, height: 104, borderRadius: 30, background: `${color.replace("rgb(", "rgba(").replace(")", " / 0.18)")}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon color={color} size={58} strokeWidth={2.2} />
            </div>
            <div style={{ color: C.label, fontSize: 50, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.1, marginTop: 40 }}>{title}</div>
            <div style={{ color: C.label2, fontSize: 34, lineHeight: 1.3, marginTop: 20 }}>{sub}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
