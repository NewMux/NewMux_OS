import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          background: "#020617",
        },
      },
    },
  },
  safelist: [
    // document status badges
    "bg-slate-500/20", "text-slate-300",
    "bg-blue-500/20", "text-blue-300",
    "bg-amber-500/20", "text-amber-300",
    "bg-emerald-500/20", "text-emerald-300",
    "bg-green-500/20", "text-green-300",
    "bg-zinc-500/20", "text-zinc-400",
    // task priority badges
    "bg-red-500/20", "text-red-300",
    "bg-orange-500/20", "text-orange-300",
    "bg-yellow-500/20", "text-yellow-300",
    "bg-sky-500/20", "text-sky-300",
  ],
  plugins: [],
};

export default config;
