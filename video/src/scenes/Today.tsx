import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { B, Backdrop, C, Caption, ChatPanel, Link, Reply, Status, UserBubble, typed } from "../kit";

const Q = "What needs me today?";

const Head: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ color: C.label2, fontSize: 22, fontWeight: 650, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 14 }}>{children}</div>
);

const Row: React.FC<{ dot: string; children: React.ReactNode; action?: string }> = ({ dot, children, action }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <span style={{ color: dot }}>●</span>
    <span style={{ flex: 1 }}>{children}</span>
    {action && (
      <span style={{ fontSize: 24, fontWeight: 600, color: C.blue, background: "rgba(10,132,255,0.16)", borderRadius: 999, padding: "4px 18px" }}>{action}</span>
    )}
  </div>
);

export const Today: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <Caption eyebrow="Your morning, sorted" title="Knows what needs you." sub="Meetings, tasks, renewals and fees, in one answer." />
      <ChatPanel enter={-30} composer={f < 30 ? typed(Q, f, 4, 1) : undefined}>
        <UserBubble text={Q} at={30} />
        <Status text="Looking at your day…" from={40} to={66} />
        <Reply
          at={66}
          every={6}
          lines={[
            <span key="0">
              Good morning. Here’s <B>today</B>:
            </span>,
            <Head key="1">Up next</Head>,
            <Row key="2" dot={C.blue}>
              11:00 · Design review with <Link>Gulf Bloom</Link>
            </Row>,
            <Row key="3" dot={C.orange}>
              Task due · <Link>Send Acme the revised quote</Link>
            </Row>,
            <Head key="4">Needs attention</Head>,
            <Row key="5" dot={C.orange} action="Collect">
              Hosting fee · Pearl Studio
            </Row>,
            <Row key="6" dot={C.red} action="Renewed">
              CR renewal in 6 days
            </Row>,
          ]}
        />
      </ChatPanel>
    </AbsoluteFill>
  );
};
