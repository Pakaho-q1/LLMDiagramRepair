import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface MindNode {
  text: string;
  shape?: string;
  icon?: string;
  class?: string;
  children: MindNode[];
  depth: number;
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

function detectShape(raw: string): { text: string; shape?: string } {
  if (raw.startsWith("((") && raw.endsWith("))"))
    return { text: raw.slice(2, -2), shape: "((" };
  if (raw.startsWith("(") && raw.endsWith(")"))
    return { text: raw.slice(1, -1), shape: "(" };
  if (raw.startsWith("[") && raw.endsWith("]"))
    return { text: raw.slice(1, -1), shape: "[" };
  if (raw.startsWith("{") && raw.endsWith("}"))
    return { text: raw.slice(1, -1), shape: "{" };
  if (raw.startsWith("{{") && raw.endsWith("}}"))
    return { text: raw.slice(2, -2), shape: "{{" };
  if (raw.startsWith(">") && raw.endsWith("]"))
    return { text: raw.slice(1, -1), shape: ">" };
  return { text: stripQuotes(raw) };
}

function indentDepth(line: string): number {
  const match = line.match(/^(\s+)/);
  if (!match) return 0;
  const raw = match[1];
  const spaces = raw.replace(/\t/g, "  ").length;
  return Math.floor(spaces / 2);
}

export function parseLooseMindmap(code: string): MindNode | null {
  const lines = code.split("\n").filter((l) => l.trimEnd().length > 0);
  if (!lines.length) return null;

  const isMindmap =
    /^(mindmap|mindMap|mind[-_]map|MindMap|Mind Map|mm\b)/i.test(
      lines[0].trim(),
    );
  if (!isMindmap) return null;

  let rootLine = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (
      t &&
      !t.startsWith("%%") &&
      !t.startsWith("::icon") &&
      !t.startsWith(":::")
    ) {
      rootLine = i;
      break;
    }
  }
  if (rootLine === -1) return null;

  const stack: MindNode[] = [];
  let root: MindNode | null = null;

  for (let i = rootLine; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue;

    const depth = indentDepth(rawLine);
    const { text, shape } = detectShape(trimmed);

    const node: MindNode = { text, shape, children: [], depth };

    if (i + 1 < lines.length) {
      const nextTrim = lines[i + 1].trim();
      if (nextTrim.startsWith("::icon(")) {
        node.icon = nextTrim.match(/::icon\(([^)]+)\)/)?.[1];
        i++;
      }
    }

    if (!root) {
      root = node;
      stack.push(node);
      continue;
    }

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth)
      stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root;
}

function renderNode(node: MindNode, indent: string): string[] {
  const lines: string[] = [];
  let text = node.text;

  if (node.shape === "((") text = `((${text}))`;
  else if (node.shape === "(") text = `(${text})`;
  else if (node.shape === "[") text = `[${text}]`;
  else if (node.shape === "{") text = `{${text}}`;
  else if (node.shape === "{{") text = `{{${text}}}`;
  else if (node.shape === ">") text = `>${text}]`;

  lines.push(`${indent}${text}`);
  if (node.icon) lines.push(`${indent}  ::icon(${node.icon})`);

  for (const child of node.children) {
    lines.push(...renderNode(child, indent + "  "));
  }
  return lines;
}

export function buildMindmap(root: MindNode): string {
  const lines = ["mindmap"];
  lines.push(...renderNode(root, "  "));
  return lines.join("\n");
}

export const mindmapRebuilderPass = {
  name: "mindmap-rebuilder",
  isRebuilder: true,
  appliesTo: ["mindmap"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const root = parseLooseMindmap(ctx.code);
    if (!root)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildMindmap(root);
    const changed = rebuilt !== ctx.code;
    function countNodes(n: MindNode): number {
      return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
    }
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed ? [`Rebuilt mindmap (${countNodes(root)} nodes)`] : [],
    };
  },
};
