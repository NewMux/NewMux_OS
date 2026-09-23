/** Static class maps for the Apple system colours (Tailwind needs literal class names). */
export type SysColor =
  | "blue"
  | "green"
  | "red"
  | "orange"
  | "yellow"
  | "teal"
  | "cyan"
  | "indigo"
  | "purple"
  | "pink"
  | "gray"
  | "brown";

export const SYS_COLORS: SysColor[] = ["blue", "green", "orange", "red", "purple", "pink", "teal", "indigo", "yellow", "gray"];

export const solidBg: Record<SysColor, string> = {
  blue: "bg-ios-blue",
  green: "bg-ios-green",
  red: "bg-ios-red",
  orange: "bg-ios-orange",
  yellow: "bg-ios-yellow",
  teal: "bg-ios-teal",
  cyan: "bg-ios-cyan",
  indigo: "bg-ios-indigo",
  purple: "bg-ios-purple",
  pink: "bg-ios-pink",
  gray: "bg-ios-gray",
  brown: "bg-ios-brown",
};

export const tintBg: Record<SysColor, string> = {
  blue: "bg-ios-blue/15",
  green: "bg-ios-green/15",
  red: "bg-ios-red/15",
  orange: "bg-ios-orange/15",
  yellow: "bg-ios-yellow/20",
  teal: "bg-ios-teal/15",
  cyan: "bg-ios-cyan/15",
  indigo: "bg-ios-indigo/15",
  purple: "bg-ios-purple/15",
  pink: "bg-ios-pink/15",
  gray: "bg-ios-gray/15",
  brown: "bg-ios-brown/15",
};

export const text: Record<SysColor, string> = {
  blue: "text-ios-blue",
  green: "text-ios-green",
  red: "text-ios-red",
  orange: "text-ios-orange",
  yellow: "text-ios-yellow",
  teal: "text-ios-teal",
  cyan: "text-ios-cyan",
  indigo: "text-ios-indigo",
  purple: "text-ios-purple",
  pink: "text-ios-pink",
  gray: "text-ios-gray",
  brown: "text-ios-brown",
};

/** Yellow text is unreadable on light backgrounds — darken it for tinted pills. */
export const tintText: Record<SysColor, string> = { ...text, yellow: "text-[#9a7b00] dark:text-ios-yellow" };

export function asSysColor(value: string | null | undefined, fallback: SysColor = "blue"): SysColor {
  return value && value in solidBg ? (value as SysColor) : fallback;
}

/** Stable colour for a name (avatars, tiles without an explicit colour). */
export function colorForName(name: string): SysColor {
  const palette: SysColor[] = ["blue", "green", "orange", "purple", "pink", "teal", "indigo", "red"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length]!;
}
