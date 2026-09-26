import type { Config } from "tailwindcss";

/** Semantic colour tokens come from CSS variables in app/globals.css, which
 * switch between Apple's light and dark system palettes. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  // Follows the OS appearance, unless the user picked Light/Dark in Settings
  // (stored as data-theme on <html>).
  darkMode: [
    "variant",
    ["@media (prefers-color-scheme: dark) { &:not(:where([data-theme=light], [data-theme=light] *)) }", "&:where([data-theme=dark], [data-theme=dark] *)"],
  ],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    // iPad/Mac layouts (sidebar, split views) need height as well as width, so
    // an iPhone turned sideways — or the installed PWA in landscape — keeps
    // the phone layout with its bottom tab bar (Improvements PRD item 38).
    screens: {
      sm: "640px",
      md: { raw: "(min-width: 768px) and (min-height: 540px)" },
      lg: { raw: "(min-width: 1024px) and (min-height: 540px)" },
      xl: { raw: "(min-width: 1280px) and (min-height: 540px)" },
      "2xl": { raw: "(min-width: 1536px) and (min-height: 540px)" },
    },
    extend: {
      colors: {
        bg: token("bg"),
        "bg-elevated": token("bg-elevated"),
        "bg-elevated-2": token("bg-elevated-2"),
        label: token("label"),
        "label-2": token("label-2"),
        "label-3": token("label-3"),
        separator: token("separator"),
        fill: token("fill"),
        "fill-2": token("fill-2"),
        accent: token("blue"),
        ios: {
          blue: token("blue"),
          green: token("green"),
          red: token("red"),
          orange: token("orange"),
          yellow: token("yellow"),
          teal: token("teal"),
          cyan: token("cyan"),
          indigo: token("indigo"),
          purple: token("purple"),
          pink: token("pink"),
          gray: token("gray"),
          brown: token("brown"),
        },
      },
      fontFamily: {
        // San Francisco on Apple devices; Inter (self-hosted, optical sizes) everywhere else.
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"SF Pro Display"', '"Inter Variable"', "system-ui", '"Segoe UI"', "Roboto", "sans-serif"],
        rounded: ["ui-rounded", '"SF Pro Rounded"', "-apple-system", "BlinkMacSystemFont", '"Inter Variable"', "system-ui", "sans-serif"],
      },
      // Apple's Dynamic Type scale. Sizes step down on md+ (iPad/Mac density).
      fontSize: {
        "large-title": ["var(--fs-large-title)", { lineHeight: "1.12", letterSpacing: "-0.008em", fontWeight: "700" }],
        title1: ["var(--fs-title1)", { lineHeight: "1.15", letterSpacing: "-0.006em", fontWeight: "700" }],
        title2: ["var(--fs-title2)", { lineHeight: "1.22", letterSpacing: "-0.004em", fontWeight: "700" }],
        title3: ["var(--fs-title3)", { lineHeight: "1.25", letterSpacing: "-0.012em", fontWeight: "600" }],
        headline: ["var(--fs-body)", { lineHeight: "1.3", letterSpacing: "-0.024em", fontWeight: "600" }],
        body: ["var(--fs-body)", { lineHeight: "1.3", letterSpacing: "-0.024em" }],
        callout: ["var(--fs-callout)", { lineHeight: "1.31", letterSpacing: "-0.02em" }],
        subhead: ["var(--fs-subhead)", { lineHeight: "1.33", letterSpacing: "-0.015em" }],
        footnote: ["var(--fs-footnote)", { lineHeight: "1.38", letterSpacing: "-0.005em" }],
        caption1: ["var(--fs-caption1)", { lineHeight: "1.33", letterSpacing: "0" }],
        caption2: ["var(--fs-caption2)", { lineHeight: "1.2", letterSpacing: "0.006em" }],
      },
      // Concentric radii (iOS 26): cards/lists, sheets, and capsules for controls.
      borderRadius: {
        "4xl": "2rem",
        card: "22px",
        sheet: "32px",
      },
      boxShadow: {
        widget: "0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.04)",
        float: "0 8px 32px rgb(0 0 0 / 0.12), 0 2px 6px rgb(0 0 0 / 0.08)",
        glass: "inset 0 0.5px 0 rgb(255 255 255 / 0.5), 0 8px 24px rgb(0 0 0 / 0.12)",
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.32, 0.72, 0, 1)",
        // Gentle overshoot for thumbs, knobs and lenses.
        spring: "cubic-bezier(0.34, 1.4, 0.64, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        // Navigation: a pushed screen slides in from the right, a popped one from the left.
        "page-push": { from: { opacity: "0", transform: "translate3d(32%, 0, 0)" }, to: { opacity: "1", transform: "translate3d(0, 0, 0)" } },
        "page-pop": { from: { opacity: "0", transform: "translate3d(-24%, 0, 0)" }, to: { opacity: "1", transform: "translate3d(0, 0, 0)" } },
        "page-fade": { from: { opacity: "0", transform: "translate3d(0, 6px, 0)" }, to: { opacity: "1", transform: "translate3d(0, 0, 0)" } },
        "pop-in": { from: { opacity: "0", transform: "scale(0.9)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "scale-in": "scale-in 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-up": "slide-up 280ms cubic-bezier(0.32, 0.72, 0, 1)",
        "page-push": "page-push 420ms cubic-bezier(0.32, 0.72, 0, 1) backwards",
        "page-pop": "page-pop 380ms cubic-bezier(0.32, 0.72, 0, 1) backwards",
        "page-fade": "page-fade 240ms ease-out backwards",
        "pop-in": "pop-in 260ms cubic-bezier(0.34, 1.4, 0.64, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
