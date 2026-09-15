import type { Config } from "tailwindcss";

/** Every color resolves to a CSS variable defined in app/globals.css, so the
 * same class works in light and dark and `/alpha` still applies. */
function token(name: string) {
  return `hsl(var(--${name}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        secondary: {
          foreground: token("secondary-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
        },
        brand: token("brand"),
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        overlay: token("overlay"),
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
        tone: {
          neutral: token("tone-neutral"),
          "neutral-fg": token("tone-neutral-fg"),
          muted: token("tone-muted"),
          "muted-fg": token("tone-muted-fg"),
          info: token("tone-info"),
          "info-fg": token("tone-info-fg"),
          success: token("tone-success"),
          "success-fg": token("tone-success-fg"),
          warning: token("tone-warning"),
          "warning-fg": token("tone-warning-fg"),
          alert: token("tone-alert"),
          "alert-fg": token("tone-alert-fg"),
          danger: token("tone-danger"),
          "danger-fg": token("tone-danger-fg"),
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      borderRadius: {
        lg: "calc(var(--radius) - 0.25rem)",
        xl: "var(--radius)",
        "2xl": "calc(var(--radius) + 0.25rem)",
      },
      keyframes: {
        "overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "content-in": {
          from: { opacity: "0", transform: "translate(-50%, -48%) scale(0.97)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },
      animation: {
        "overlay-in": "overlay-in 150ms ease-out",
        "content-in": "content-in 150ms ease-out",
        "sheet-in": "sheet-in 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
