import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface TreemapNode {
  label: string;
  value?: number;
  children: TreemapNode[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

function indentDepth(line: string): number {
  const m = line.match(/^(\s+)/);
  if (!m) return 0;
  return m[1].replace(/\t/g, "  ").length;
}

export function parseLooseTreemap(code: string): TreemapNode | null {
  const rawLines = code.split("\n");
  const lines = rawLines.filter((l) => l.trimEnd().length > 0);
  if (!lines.length) return null;

  const isTreemap = /^(treemap(-beta)?|Treemap|tree[-_]map|TreeMap)/i.test(
    lines[0].trim(),
  );
  if (!isTreemap) return null;

  let rootLine = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() && !lines[i].trim().startsWith("%%")) {
      rootLine = i;
      break;
    }
  }
  if (rootLine === -1) return null;

  const stack: { node: TreemapNode; depth: number }[] = [];
  let root: TreemapNode | null = null;

  for (let i = rootLine; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue;

    const depth = indentDepth(rawLine);

    let label = trimmed;
    let value: number | undefined;

    const colonMatch = trimmed.match(/^(.+?)\s*:\s*([\d.]+)\s*$/);
    const bracketMatch = trimmed.match(/^(.+?)\s*\[([\d.]+)\]\s*$/);

    if (colonMatch) {
      label = stripQuotes(colonMatch[1]);
      value = parseFloat(colonMatch[2]);
    } else if (bracketMatch) {
      label = stripQuotes(bracketMatch[1]);
      value = parseFloat(bracketMatch[2]);
    } else {
      label = stripQuotes(trimmed);
    }

    const node: TreemapNode = { label, value, children: [] };

    if (!root) {
      root = node;
      stack.push({ node, depth });
      continue;
    }

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth)
      stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, depth });
  }

  return root;
}

function renderNode(node: TreemapNode, indent: string): string[] {
  const lines: string[] = [];
  const val = node.value !== undefined ? ` : ${node.value}` : "";
  lines.push(`${indent}${node.label}${val}`);
  for (const child of node.children) {
    lines.push(...renderNode(child, indent + "  "));
  }
  return lines;
}

export function buildTreemap(root: TreemapNode): string {
  const lines = ["treemap-beta"];
  lines.push(...renderNode(root, "  "));
  return lines.join("\n");
}

export const treemapRebuilderPass = {
  name: "treemap-rebuilder",
  isRebuilder: true,
  appliesTo: ["treemap-beta"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const root = parseLooseTreemap(ctx.code);
    if (!root)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildTreemap(root);
    const changed = rebuilt !== ctx.code;
    function count(n: TreemapNode): number {
      return 1 + n.children.reduce((s, c) => s + count(c), 0);
    }
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed ? [`Rebuilt treemap-beta (${count(root)} nodes)`] : [],
    };
  },
};
