/**
 * Section text (plan 10 §3): a small, safe markup instead of rich HTML — headings, paragraphs, bullets, source
 * notes and two block kinds (a GHG table, a scope chart). Numbers never sit in the text as typed digits: a token
 * {{ghg.scope1}} or {{ghg.scope2.location|ghg_operational_control}} is bound to one metric fact version on save
 * and rendered from it. Pure functions: parse, list tokens, render with the bound values.
 */

export type Block =
  | { type: "h1" | "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "source"; text: string }
  | { type: "table"; name: "ghg" }
  | { type: "chart"; name: "ghg_scopes" };

export const TOKEN = /\{\{\s*([a-z0-9_]+(?:\.[a-z0-9_]+)*)(?:\|([a-z_]+))?\s*\}\}/g;
export const BLOCKS = { table: ["ghg"], chart: ["ghg_scopes"] } as const;

export type Token = { raw: string; key: string; boundary: string | null };

export function tokens(body: string): Token[] {
  const out: Token[] = [];
  for (const m of body.matchAll(TOKEN)) if (!out.some((t) => t.raw === m[0])) out.push({ raw: m[0], key: m[1], boundary: m[2] ?? null });
  return out;
}

/** Blocks a table or chart directive needs facts for. */
export function directives(body: string): Block[] {
  return parse(body).filter((b) => b.type === "table" || b.type === "chart");
}

export function parse(body: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    if (list.length) blocks.push({ type: "ul", items: list });
    para = [];
    list = [];
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const dir = /^\[\[(table|chart):([a-z_]+)\]\]$/.exec(line);
    if (dir) {
      flush();
      if (dir[1] === "table" && dir[2] === "ghg") blocks.push({ type: "table", name: "ghg" });
      else if (dir[1] === "chart" && dir[2] === "ghg_scopes") blocks.push({ type: "chart", name: "ghg_scopes" });
      else blocks.push({ type: "p", text: line });
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("# ")) {
      flush();
      blocks.push({ type: "h1", text: line.slice(2).trim() });
    } else if (line.startsWith("> ")) {
      flush();
      blocks.push({ type: "source", text: line.slice(2).trim() });
    } else if (line.startsWith("- ")) {
      if (para.length) {
        blocks.push({ type: "p", text: para.join(" ") });
        para = [];
      }
      list.push(line.slice(2).trim());
    } else {
      if (list.length) {
        blocks.push({ type: "ul", items: list });
        list = [];
      }
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** Replaces each token with its bound rendering; an unbound token stays visible as a marked gap. */
export function render(text: string, bound: Map<string, string>): string {
  return text.replace(TOKEN, (raw) => bound.get(raw) ?? `[? ${raw.slice(2, -2).trim()}]`);
}

/** The prose a person wrote, without tokens and directives (green-claim screening reads this). */
export function prose(body: string): string {
  return parse(body)
    .flatMap((b) => (b.type === "ul" ? b.items : "text" in b ? [b.text] : []))
    .join("\n")
    .replace(TOKEN, " ");
}
