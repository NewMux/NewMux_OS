import type { KbContent } from "@/lib/data/types";

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: { type: string }[] };

/** "Some **bold** text" → text nodes, with bold marked. */
function inline(line: string): Node[] {
  const out: Node[] = [];
  for (const part of line.split(/(\*\*[^*]+\*\*)/)) {
    if (!part) continue;
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    out.push(bold ? { type: "text", text: bold[1]!, marks: [{ type: "bold" }] } : { type: "text", text: part });
  }
  return out;
}

const paragraph = (line: string): Node => ({ type: "paragraph", ...(line ? { content: inline(line) } : {}) });

/**
 * Haman writes wiki pages as plain text; the editor stores TipTap JSON.
 * Handles what the editor offers: headings (#, ##, ###), bullets, numbered
 * lists, checklists ([ ] / [x]), quotes (>) and paragraphs.
 */
export function textToDoc(text: string): KbContent {
  const blocks: Node[] = [];
  let list: Node | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push(paragraph(para.join(" ")));
    para = [];
  };
  const endList = () => {
    list = null;
  };
  const addItem = (type: "bulletList" | "orderedList" | "taskList", item: Node) => {
    flushPara();
    if (!list || list.type !== type) {
      list = { type, content: [] };
      blocks.push(list);
    }
    list.content!.push(item);
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    let m: RegExpExecArray | null;
    if (!line) {
      flushPara();
      endList();
    } else if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
      flushPara();
      endList();
      blocks.push({ type: "heading", attrs: { level: m[1]!.length }, content: inline(m[2]!) });
    } else if ((m = /^[-*]\s+\[( |x|X)\]\s*(.*)$/.exec(line)) || (m = /^\[( |x|X)\]\s*(.*)$/.exec(line))) {
      addItem("taskList", { type: "taskItem", attrs: { checked: m[1] !== " " }, content: [paragraph(m[2]!)] });
    } else if ((m = /^[-*•]\s+(.*)$/.exec(line))) {
      addItem("bulletList", { type: "listItem", content: [paragraph(m[1]!)] });
    } else if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) {
      addItem("orderedList", { type: "listItem", content: [paragraph(m[1]!)] });
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flushPara();
      endList();
      blocks.push({ type: "blockquote", content: [paragraph(m[1]!)] });
    } else {
      endList();
      para.push(line);
    }
  }
  flushPara();
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}
