# Haman launch video

A 45-second, 1920×1080 launch video for Haman, built with [Remotion](https://remotion.dev) in the NEWMUX OS dark Liquid Glass style. The rendered file is `haman-launch.mp4`.

This is a separate package from the app (its own `package.json`, excluded from the app's `tsconfig.json` and ESLint).

- `src/kit.tsx`: colours from `app/globals.css`, glass material, the Haman chat panel, bubbles and animation helpers.
- `src/scenes/`: one file per scene (Hook, Reveal, Ask, Today, Act, Trust, Everywhere, EndCard).
- `src/HamanLaunch.tsx`: scene order and lengths, with 14-frame crossfades.

```bash
cd video
npm install
npx remotion studio                                   # preview and edit
npx remotion render HamanLaunch haman-launch.mp4      # render
```

In a cloud session without Remotion's own browser download, add `--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.

Client names and amounts in the video are made up.
