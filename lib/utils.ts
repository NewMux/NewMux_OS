import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default font sizes. Without this, it
// reads our Dynamic Type sizes (text-body, text-caption1, …) as text colours
// and drops one of e.g. "text-white text-body" or "text-caption1 text-ios-red".
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["large-title", "title1", "title2", "title3", "headline", "body", "callout", "subhead", "footnote", "caption1", "caption2"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "1 meeting", "2 meetings". */
export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
