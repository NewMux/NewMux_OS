import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, C, FONT, glass, prog, rise } from "../kit";

const TABS: [string, number, number][] = [
  ["Invoices", 260, 230],
  ["Pipeline", 1420, 180],
  ["Tasks", 520, 820],
  ["Calendar", 1250, 860],
  ["Expenses", 180, 560],
  ["Wiki", 1580, 520],
  ["Follow-ups", 760, 150],
  ["Hosting fees", 1010, 690],
  ["Payouts", 1640, 980],
  ["Renewals", 1480, 330],
  ["Clients", 740, 900],
  ["Forecast", 1180, 120],
  ["Projects", 120, 760],
  ["Reconcile", 1600, 760],
];

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const chaosOut = prog(f, 82, 20);
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop intensity={0.5} />
      {TABS.map(([name, x, y], i) => {
        const at = 6 + i * 4;
        const p = prog(f, at, 14);
        const drift = Math.sin((f + i * 13) / 18) * 10;
        return (
          <div
            key={name}
            style={{
              ...glass,
              position: "absolute",
              left: x,
              top: y + drift,
              padding: "16px 30px",
              borderRadius: 999,
              color: C.label2,
              fontSize: 30,
              fontWeight: 600,
              opacity: p * (1 - chaosOut) * 0.9,
              scale: `${0.7 + 0.3 * p - chaosOut * 0.2}`,
              filter: `blur(${chaosOut * 12}px)`,
            }}
          >
            {name}
          </div>
        );
      })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div
          style={{
            ...rise(f, 20, 40, 24),
            opacity: interpolate(f, [20, 40, 78, 92], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            color: C.label,
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: -3.5,
            lineHeight: 1.05,
            textShadow: "0 4px 40px rgba(0,0,0,0.9)",
          }}
        >
          Running a company
          <br />
          is a lot of tabs.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ ...rise(f, 96, 40, 24), color: C.label, fontSize: 104, fontWeight: 700, letterSpacing: -3.5 }}>
          What if you could <span style={{ color: C.blue }}>just ask?</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
