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
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        rounded: ["ui-rounded", '"SF Pro Rounded"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      // Apple's Dynamic Type scale. Sizes step down on md+ (iPad/Mac density).
      fontSize: {
        "large-title": ["var(--fs-large-title)", { lineHeight: "1.2", letterSpacing: "0.011em", fontWeight: "700" }],
        title1: ["var(--fs-title1)", { lineHeight: "1.2", letterSpacing: "0.013em", fontWeight: "700" }],
        title2: ["var(--fs-title2)", { lineHeight: "1.27", letterSpacing: "0.016em", fontWeight: "700" }],
        title3: ["var(--fs-title3)", { lineHeight: "1.25", letterSpacing: "0.019em", fontWeight: "600" }],
        headline: ["var(--fs-body)", { lineHeight: "1.3", letterSpacing: "-0.024em", fontWeight: "600" }],
        body: ["var(--fs-body)", { lineHeight: "1.3", letterSpacing: "-0.024em" }],
        callout: ["var(--fs-callout)", { lineHeight: "1.31", letterSpacing: "-0.02em" }],
        subhead: ["var(--fs-subhead)", { lineHeight: "1.33", letterSpacing: "-0.015em" }],
        footnote: ["var(--fs-footnote)", { lineHeight: "1.38", letterSpacing: "-0.005em" }],
        caption1: ["var(--fs-caption1)", { lineHeight: "1.33", letterSpacing: "0" }],
        caption2: ["var(--fs-caption2)", { lineHeight: "1.2", letterSpacing: "0.006em" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        widget: "0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.04)",
        float: "0 8px 32px rgb(0 0 0 / 0.12), 0 2px 6px rgb(0 0 0 / 0.08)",
        glass: "inset 0 0.5px 0 rgb(255 255 255 / 0.5), 0 8px 24px rgb(0 0 0 / 0.12)",
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "scale-in": "scale-in 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-up": "slide-up 280ms cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
