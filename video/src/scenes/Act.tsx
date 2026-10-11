import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Check } from "lucide-react";
import { Backdrop, C, Caption, ChatPanel, Link, Reply, Status, UserBubble, prog, rise, typed } from "../kit";

const Q = "Add a task to follow up with Acme tomorrow";
const CARD_AT = 92;
const TAP = 150;

const Field: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div style={{ display: "flex", gap: 20, fontSize: 27 }}>
    <span style={{ width: 160, color: C.label2 }}>{k}</span>
    <span style={{ color: C.label }}>{v}</span>
  </div>
);

const ActionCard: React.FC = () => {
  const f = useCurrentFrame();
  if (f < CARD_AT) return null;
  const done = f >= TAP + 14;
  const press = interpolate(f, [TAP - 2, TAP + 2, TAP + 8], [1, 0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const spin = f >= TAP + 2 && !done;
  return (
    <div
      style={{
        ...rise(f, CARD_AT, 30, 18),
        alignSelf: "stretch",
        borderRadius: 30,
        background: C.bg,
        boxShadow: "0 0 0 1.5px rgba(255,255,255,0.16), 0 0 60px rgba(10,132,255,0.15)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "22px 28px 18px" }}>
        <div style={{ color: C.label2, fontSize: 22, fontWeight: 650, letterSpacing: 1.2, textTransform: "uppercase" }}>New task</div>
        <div style={{ color: C.label, fontSize: 32, fontWeight: 650, margin: "4px 0 12px" }}>Follow up with Acme Trading</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Field k="Project" v="Acme website" />
          <Field k="Due" v="Tomorrow" />
          <Field k="Assignee" v="You" />
          <Field k="Priority" v="High" />
        </div>
      </div>
      {!done ? (
        <div style={{ display: "flex", gap: 16, padding: "16px 22px", borderTop: `1.5px solid ${C.separator}` }}>
          <div style={{ flex: 1, height: 68, borderRadius: 999, background: C.fill, color: C.label, fontSize: 28, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>Cancel</div>
          <div
            style={{
              flex: 1,
              height: 68,
              borderRadius: 999,
              background: C.blue,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 24px rgba(10,132,255,0.45)",
              color: "white",
              fontSize: 28,
              fontWeight: 650,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              scale: `${press}`,
            }}
          >
            {spin && <span style={{ width: 26, height: 26, borderRadius: 13, border: "3.5px solid white", borderTopColor: "transparent", rotate: `${f * 30}deg` }} />}
            Confirm
          </div>
        </div>
      ) : (
        <div style={{ ...rise(f, TAP + 14, 8, 10), display: "flex", alignItems: "center", gap: 12, padding: "18px 28px", borderTop: `1.5px solid ${C.separator}`, color: C.green, fontSize: 28, fontWeight: 600 }}>
          <Check size={32} strokeWidth={2.8} /> Done
          <span style={{ marginLeft: "auto" }}>
            <Link>Open task ›</Link>
          </span>
        </div>
      )}
    </div>
  );
};

/** A finger-tap indicator gliding to the Confirm button. */
const Touch: React.FC = () => {
  const f = useCurrentFrame();
  const p = prog(f, TAP - 26, 22);
  const vis = interpolate(f, [TAP - 30, TAP - 22, TAP + 10, TAP + 20], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ring = prog(f, TAP, 14);
  return (
    <div style={{ position: "absolute", left: 1560 - 140 * (1 - p), top: 800 + 120 * (1 - p), opacity: vis, pointerEvents: "none" }}>
      <div style={{ position: "absolute", width: 64, height: 64, left: -32, top: -32, borderRadius: 32, background: "rgba(255,255,255,0.35)", border: "2px solid rgba(255,255,255,0.8)", scale: `${f >= TAP ? 0.85 : 1}` }} />
      <div style={{ position: "absolute", width: 64, height: 64, left: -32, top: -32, borderRadius: 32, border: "3px solid white", opacity: f >= TAP ? 1 - ring : 0, scale: `${1 + ring * 1.4}` }} />
    </div>
  );
};

export const Act: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <Caption eyebrow="Ask him to do it" title="He prepares. You confirm." sub="Every change is a card. Nothing is saved until you tap Confirm." />
      <ChatPanel enter={-30} composer={f < 44 ? typed(Q, f, 2, 1.1) : undefined}>
        <UserBubble text={Q} at={44} />
        <Status text="Preparing the task…" from={54} to={78} />
        <Reply at={78} lines={["Here’s the task. Confirm to save it."]} />
        <ActionCard />
      </ChatPanel>
      <Touch />
    </AbsoluteFill>
  );
};
