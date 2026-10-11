import "@fontsource-variable/inter";
import React from "react";
import { Composition, Folder, continueRender, delayRender } from "remotion";
import { HamanLaunch, SCENES, TOTAL } from "./HamanLaunch";

const fontHandle = delayRender("Loading Inter");
Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "Inter Variable"`))).then(() => continueRender(fontHandle));

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HamanLaunch" component={HamanLaunch} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Folder name="Scenes">
      {SCENES.map(({ name, C, d }) => (
        <Composition key={name} id={name} component={C} durationInFrames={d} fps={30} width={1920} height={1080} />
      ))}
    </Folder>
  </>
);
