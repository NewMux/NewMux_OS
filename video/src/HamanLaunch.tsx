import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Hook } from "./scenes/Hook";
import { Reveal } from "./scenes/Reveal";
import { Ask } from "./scenes/Ask";
import { Today } from "./scenes/Today";
import { Act } from "./scenes/Act";
import { Trust } from "./scenes/Trust";
import { Everywhere } from "./scenes/Everywhere";
import { EndCard } from "./scenes/EndCard";

export const SCENES = [
  { name: "Hook", C: Hook, d: 150 },
  { name: "Reveal", C: Reveal, d: 120 },
  { name: "Ask", C: Ask, d: 240 },
  { name: "Today", C: Today, d: 200 },
  { name: "Act", C: Act, d: 240 },
  { name: "Trust", C: Trust, d: 180 },
  { name: "Everywhere", C: Everywhere, d: 170 },
  { name: "EndCard", C: EndCard, d: 150 },
];
export const T = 14;
export const TOTAL = SCENES.reduce((a, s) => a + s.d, 0) - T * (SCENES.length - 1);

export const HamanLaunch: React.FC = () => (
  <TransitionSeries>
    {SCENES.flatMap(({ name, C, d }, i) => [
      ...(i > 0 ? [<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: T })} />] : []),
      <TransitionSeries.Sequence key={name} name={name} durationInFrames={d}>
        <C />
      </TransitionSeries.Sequence>,
    ])}
  </TransitionSeries>
);
