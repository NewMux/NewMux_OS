/**
 * The small subset of Markdown Haman is asked to write, parsed into plain
 * data for components/haman/HamanSheet.tsx to render: paragraphs, bullet and
 * numbered lists, **bold** and [links](href). Anything else stays as text,
 * and nothing here ever produces HTML.
 */

export type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

export type Span =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  /** `internal`: a screen in this app (opens in place). Otherwise an http(s) address (opens in a new tab). */
  | { kind: "link"; text: string; href: string; internal: boolean };

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    // A heading is shown as an ordinary line.
    const line = raw.replace(/^\s*#{1,6}\s+/, "").trimEnd();
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const kind = BULLET.test(line) ? "ul" : "ol";
      const item = line.replace(kind === "ul" ? BULLET : NUMBERED, "");
      if (last?.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (last?.kind === "p") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}

const INLINE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

/**
 * Splits one line into text, bold and link spans. A link is kept only when it
 * points inside the app ("/clients/…") or at an http(s) address; any other
 * scheme (javascript:, data:, mailto:…) is reduced to its label.
 */
export function toSpans(line: string): Span[] {
  const spans: Span[] = [];
  for (const part of line.split(INLINE)) {
    if (!part) continue;
    const link = LINK.exec(part);
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      spans.push({ kind: "bold", text: part.slice(2, -2) });
    } else if (link) {
      const label = link[1]!;
      const href = link[2]!;
      if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) spans.push({ kind: "link", text: label, href, internal: true });
      else if (/^https?:\/\//i.test(href)) spans.push({ kind: "link", text: label, href, internal: false });
      else spans.push({ kind: "text", text: label });
    } else {
      spans.push({ kind: "text", text: part });
    }
  }
  return spans;
}
