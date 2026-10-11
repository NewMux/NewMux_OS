import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Sparkles } from "lucide-react";
import { Backdrop, C, FONT, glass, prog, rise } from "../kit";

const Line: React.FC<{ w: number | string; c?: string; h?: number }> = ({ w, c = "rgba(118,118,128,0.35)", h = 14 }) => (
  <div style={{ width: w, height: h, borderRadius: h / 2, background: c }} />
);

const MiniChat: React.FC<{ scale: number }> = ({ scale: k }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 * k, padding: 18 * k }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 * k }}>
      <Sparkles color={C.blue} size={26 * k} />
      <span style={{ color: C.label, fontSize: 24 * k, fontWeight: 700 }}>Haman</span>
    </div>
    <div style={{ alignSelf: "flex-end", background: C.blue, borderRadius: 16 * k, padding: `${8 * k}px ${14 * k}px`, color: "white", fontSize: 17 * k }}>What needs me today?</div>
    <div style={{ background: C.elevated, borderRadius: 16 * k, padding: 14 * k, display: "flex", flexDirection: "column", gap: 9 * k }}>
      <Line w="80%" c="rgba(255,255,255,0.55)" h={10 * k} />
      <Line w="60%" c="rgba(10,132,255,0.8)" h={10 * k} />
      <Line w="70%" h={10 * k} />
      <Line w="50%" h={10 * k} />
    </div>
    <div style={{ background: C.elevated, borderRadius: 16 * k, padding: 14 * k, display: "flex", flexDirection: "column", gap: 9 * k }}>
      <Line w="40%" h={8 * k} />
      <Line w="75%" c="rgba(255,255,255,0.55)" h={10 * k} />
      <div style={{ display: "flex", gap: 8 * k, marginTop: 4 * k }}>
        <div style={{ flex: 1, height: 28 * k, borderRadius: 99, background: C.fill }} />
        <div style={{ flex: 1, height: 28 * k, borderRadius: 99, background: C.blue }} />
      </div>
    </div>
  </div>
);

const Mac: React.FC = () => (
  <div style={{ width: 1060, height: 680, borderRadius: 28, background: C.bg, boxShadow: "0 0 0 2px rgba(255,255,255,0.14), 0 40px 120px rgba(0,0,0,0.7)", overflow: "hidden", display: "flex" }}>
    <div style={{ width: 230, background: "rgb(20 20 22)", padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
        ))}
      </div>
      {["Today", "CRM", "Work", "Finance", "Wiki", "Company"].map((s, i) => (
        <div key={s} style={{ color: i === 0 ? C.label : C.label2, fontSize: 20, fontWeight: i === 0 ? 650 : 500 }}>{s}</div>
      ))}
      <div style={{ marginTop: "auto", color: C.blue, fontSize: 20, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
        <Sparkles size={20} /> Ask Haman
      </div>
    </div>
    <div style={{ flex: 1, padding: 34, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ color: C.label, fontSize: 36, fontWeight: 750 }}>Today</div>
      <div style={{ display: "flex", gap: 14 }}>
        {[C.green, C.blue, C.orange].map((c) => (
          <div key={c} style={{ flex: 1, height: 96, borderRadius: 18, background: C.elevated, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <Line w="50%" h={10} />
            <Line w="70%" c={c} h={18} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, borderRadius: 18, background: C.elevated, padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        {[0.7, 0.55, 0.8, 0.6].map((w, i) => (
          <Line key={i} w={`${w * 100}%`} h={12} />
        ))}
      </div>
    </div>
    <div style={{ width: 330, margin: 12, borderRadius: 22, background: "rgb(10 10 12)", boxShadow: "0 0 0 1.5px rgba(255,255,255,0.12)" }}>
      <MiniChat scale={1} />
    </div>
  </div>
);

const Phone: React.FC = () => (
  <div style={{ width: 340, height: 700, borderRadius: 60, background: "#111", padding: 12, boxShadow: "0 0 0 3px rgba(255,255,255,0.18), 0 40px 120px rgba(0,0,0,0.8)" }}>
    <div style={{ width: "100%", height: "100%", borderRadius: 50, background: "rgb(14 14 16)", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 14, left: "50%", translate: "-50% 0px", width: 110, height: 32, borderRadius: 16, background: "black" }} />
      <div style={{ padding: "70px 22px 0", color: C.label, fontSize: 30, fontWeight: 750 }}>Today</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 520, borderRadius: "34px 34px 0 0", background: C.bg, boxShadow: "0 -1px 0 rgba(255,255,255,0.15)" }}>
        <div style={{ width: 50, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.3)", margin: "10px auto 0" }} />
        <MiniChat scale={0.95} />
      </div>
    </div>
  </div>
);

const MODELS = ["Haiku 5.5", "Sonnet 5.5", "Opus 5.5", "Fable 5.1"];

export const Everywhere: React.FC = () => {
  const f = useCurrentFrame();
  const sel = f < 100 ? 2 : f < 125 ? 3 : 2;
  const pick = prog(f, 70, 18);
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop />
      <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", ...rise(f, 0, 30) }}>
        <div style={{ color: C.label, fontSize: 84, fontWeight: 700, letterSpacing: -2.5 }}>On iPhone, iPad and Mac.</div>
      </div>
      <div style={{ position: "absolute", left: 300, top: 220, ...rise(f, 10, 80, 30) }}>
        <Mac />
      </div>
      <div style={{ position: "absolute", left: 1320, top: 250, ...rise(f, 20, 80, 30), rotate: `${interpolate(f, [20, 180], [-2, 1])}deg` }}>
        <Phone />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", justifyContent: "center", opacity: pick, translate: `0px ${(1 - pick) * 30}px` }}>
        <div style={{ ...glass, display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 999 }}>
          <span style={{ color: C.label2, fontSize: 26, padding: "0 16px 0 22px" }}>Pick his model</span>
          {MODELS.map((m, i) => (
            <span key={m} style={{ fontSize: 26, fontWeight: 600, padding: "12px 26px", borderRadius: 999, color: i === sel ? "white" : C.label, background: i === sel ? C.blue : "transparent" }}>
              {m}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
