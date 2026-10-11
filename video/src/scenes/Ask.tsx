import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Search, Sparkles } from "lucide-react";
import { B, Backdrop, C, Caption, ChatPanel, FONT, Link, Reply, Status, UserBubble, glass, prog, typed } from "../kit";

const Q = "Who owes us money?";

const Palette: React.FC = () => {
  const f = useCurrentFrame();
  const inP = prog(f, 0, 16);
  const out = prog(f, 56, 12);
  const press = interpolate(f, [48, 52, 56], [1, 0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hl = prog(f, 34, 8);
  return (
    <div
      style={{
        ...glass,
        position: "absolute",
        left: 880,
        top: 300,
        width: 860,
        borderRadius: 40,
        fontFamily: FONT,
        overflow: "hidden",
        opacity: inP * (1 - out),
        scale: `${(0.94 + 0.06 * inP) * (1 - out * 0.05)}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "30px 36px", borderBottom: `1.5px solid ${C.separator}` }}>
        <Search color={C.label2} size={36} />
        <span style={{ fontSize: 38, color: C.label }}>{typed(Q, f, 8)}</span>
        <span style={{ width: 3, height: 44, background: C.blue, opacity: Math.floor(f / 8) % 2 ? 1 : 0.2 }} />
        <span style={{ marginLeft: "auto", fontSize: 26, color: C.label3, border: `1.5px solid ${C.separator}`, borderRadius: 10, padding: "4px 12px" }}>⌘K</span>
      </div>
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "22px 24px",
            borderRadius: 24,
            background: `rgba(10,132,255,${0.9 * hl})`,
            scale: `${press}`,
          }}
        >
          <Sparkles color={hl > 0.5 ? "white" : C.blue} size={34} />
          <span style={{ fontSize: 32, color: C.label, fontWeight: 600 }}>Ask Haman</span>
          <span style={{ fontSize: 30, color: hl > 0.5 ? "rgba(255,255,255,0.8)" : C.label2 }}>“{typed(Q, f, 8)}”</span>
        </div>
        {["Invoices", "Receivables aging"].map((r) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", fontSize: 30, color: C.label2 }}>
            <Search color={C.label3} size={30} /> {r}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Ask: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <Caption eyebrow="Ask anything" title="Answers from your live records." sub="Every figure comes with a link to open it." />
      {f < 72 && <Palette />}
      {f >= 58 && (
        <ChatPanel enter={58}>
          <UserBubble text={Q} at={68} />
          <Status text="Checking invoices and payments…" from={80} to={112} />
          <Reply
            at={112}
            lines={[
              <span key="a">
                Three clients owe <B>BHD 4,820.000</B>:
              </span>,
              <div key="b" style={{ display: "flex", gap: 14, marginTop: 10 }}>
                <span style={{ color: C.red }}>●</span>
                <span>
                  <Link>Acme Trading</Link> · BHD 2,400 · <span style={{ color: C.red }}>32 days overdue</span>
                </span>
              </div>,
              <div key="c" style={{ display: "flex", gap: 14 }}>
                <span style={{ color: C.orange }}>●</span>
                <span>
                  <Link>Gulf Bloom</Link> · BHD 1,650 · due Friday
                </span>
              </div>,
              <div key="d" style={{ display: "flex", gap: 14 }}>
                <span style={{ color: C.red }}>●</span>
                <span>
                  <Link>Pearl Studio</Link> · BHD 770 · <span style={{ color: C.red }}>9 days overdue</span>
                </span>
              </div>,
              <div key="e" style={{ marginTop: 12 }}>
                Acme is the one to chase first. <Link>Open receivables ›</Link>
              </div>,
            ]}
          />
        </ChatPanel>
      )}
    </AbsoluteFill>
  );
};
