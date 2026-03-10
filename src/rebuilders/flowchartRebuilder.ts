import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

type NodeShape =
  | "rect"
  | "round"
  | "stadium"
  | "diamond"
  | "hexagon"
  | "circle"
  | "default";

interface FlowNode {
  id: string;
  label?: string;
  shape: NodeShape;
}

type ArrowStyle = "-->" | "---" | "==>" | "-.->" | "-.->";

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  style: ArrowStyle;
}

interface Subgraph {
  id: string;
  label?: string;
  nodeIds: string[];
}

interface FlowchartModel {
  direction: "TD" | "LR" | "TB" | "RL" | "BT";
  nodes: Map<string, FlowNode>;
  edges: FlowEdge[];
  subgraphs: Subgraph[];
}

export function parseLooseFlowchart(code: string): FlowchartModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("%%"));

  if (!lines.length) return null;

  const headerLine = lines[0].toLowerCase();
  const isFlowchart =
    /^(flowchart|graph|flow[-_]?chart|flow[-_]?diagram|network[-_]?diagram|process[-_]?diagram)/.test(
      headerLine,
    );

  const isHeaderless =
    !isFlowchart &&
    lines.some(
      (l) => /^\w[\w\s]*\s*(-->|---|\|[^|])/.test(l) || /-->\s*\w/.test(l),
    ) &&
    !lines.some((l) =>
      /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|timeline)/i.test(
        l,
      ),
    );

  if (!isFlowchart && !isHeaderless) return null;

  const dirMatch = lines[0].match(/\b(TD|TB|LR|RL|BT)\b/i);
  const direction = (dirMatch?.[1]?.toUpperCase() ??
    "TD") as FlowchartModel["direction"];

  const startIdx = isFlowchart ? 1 : 0;

  const model: FlowchartModel = {
    direction,
    nodes: new Map(),
    edges: [],
    subgraphs: [],
  };

  let currentSubgraph: Subgraph | null = null;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    const subgraphMatch = line.match(
      /^subgraph\s+(\w+)(?:\s*\[["']?(.+?)["']?\])?/i,
    );
    if (subgraphMatch) {
      currentSubgraph = {
        id: subgraphMatch[1],
        label: subgraphMatch[2]?.trim(),
        nodeIds: [],
      };
      model.subgraphs.push(currentSubgraph);
      continue;
    }

    if (/^end\s*$/i.test(line)) {
      currentSubgraph = null;
      continue;
    }

    const edgeParsed = parseEdgeLine(line);
    if (edgeParsed) {
      const { nodes, edges } = edgeParsed;
      for (const node of nodes) {
        if (!model.nodes.has(node.id)) {
          model.nodes.set(node.id, node);
        }
        if (currentSubgraph) {
          currentSubgraph.nodeIds.push(node.id);
        }
      }
      model.edges.push(...edges);
      continue;
    }

    const nodeOnly = parseNodeDefinition(line);
    if (nodeOnly) {
      if (!model.nodes.has(nodeOnly.id)) {
        model.nodes.set(nodeOnly.id, nodeOnly);
      }
      if (currentSubgraph) {
        currentSubgraph.nodeIds.push(nodeOnly.id);
      }
    }
  }

  if (!model.edges.length && model.nodes.size < 2) return null;

  return model;
}

interface EdgeParseResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function parseEdgeLine(line: string): EdgeParseResult | null {
  const normalized = line
    .replace(/--{2,}>/g, "-->")
    .replace(/={3,}>/g, "==>")
    .replace(/\.-+>/g, "-.->");

  if (!/-->|---|==>|-.->|\.\.\.>/.test(normalized)) return null;

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const ARROW_SPLIT = /(-->|---|==>|-\.->|\.\.\.>)(?:\|([^|]*)\|)?/g;

  const parts: string[] = [];
  const arrows: { style: ArrowStyle; label?: string }[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ARROW_SPLIT.exec(normalized)) !== null) {
    parts.push(normalized.slice(lastIndex, match.index).trim());
    arrows.push({
      style: match[1] as ArrowStyle,
      label: match[2]?.trim() || undefined,
    });
    lastIndex = match.index + match[0].length;
  }
  parts.push(normalized.slice(lastIndex).trim());

  if (parts.length < 2) return null;

  for (const part of parts) {
    if (!part) continue;
    const node = parseNodeDefinition(part);
    if (node) nodes.push(node);
  }

  for (let i = 0; i < arrows.length; i++) {
    const fromPart = parts[i];
    const toPart = parts[i + 1];
    if (!fromPart || !toPart) continue;

    const fromNode = parseNodeDefinition(fromPart);
    const toNode = parseNodeDefinition(toPart);
    if (!fromNode || !toNode) continue;

    let edgeLabel = arrows[i].label;
    if (!edgeLabel) {
      const inlineLabel = fromPart.match(/--\s*["']?(.+?)["']?\s*$/);
      if (inlineLabel) edgeLabel = inlineLabel[1].trim();
    }

    edges.push({
      from: fromNode.id,
      to: toNode.id,
      label: edgeLabel,
      style: arrows[i].style,
    });
  }

  return edges.length > 0 ? { nodes, edges } : null;
}

function parseNodeDefinition(raw: string): FlowNode | null {
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\w[\w-]*)(?:\s*\(\((.+?)\)\))?$/);
  if (m && m[2]) return { id: m[1], label: stripQuotes(m[2]), shape: "circle" };

  m = s.match(/^(\w[\w-]*)(?:\s*\(\[(.+?)\]\))?$/);
  if (m && m[2])
    return { id: m[1], label: stripQuotes(m[2]), shape: "stadium" };

  m = s.match(/^(\w[\w-]*)\s*\{\{(.+?)\}\}$/);
  if (m) return { id: m[1], label: stripQuotes(m[2]), shape: "hexagon" };

  m = s.match(/^(\w[\w-]*)\s*\{(.+?)\}$/);
  if (m) return { id: m[1], label: stripQuotes(m[2]), shape: "diamond" };

  m = s.match(/^(\w[\w-]*)\s*\[(.+?)\]$/);
  if (m) return { id: m[1], label: stripQuotes(m[2]), shape: "rect" };

  m = s.match(/^(\w[\w-]*)\s*\((.+?)\)$/);
  if (m) return { id: m[1], label: stripQuotes(m[2]), shape: "round" };

  m = s.match(/^(\w[\w-]*)$/);
  if (m) return { id: m[1], label: undefined, shape: "default" };

  return null;
}

export function buildFlowchart(model: FlowchartModel): string {
  const lines: string[] = [`flowchart ${model.direction}`];

  const nodesInEdges = new Set<string>();
  for (const edge of model.edges) {
    nodesInEdges.add(edge.from);
    nodesInEdges.add(edge.to);
  }

  for (const [id, node] of model.nodes) {
    if (!nodesInEdges.has(id) && node.label) {
      lines.push(`  ${formatNode(node)}`);
    }
  }

  const subgraphNodeIds = new Set<string>();
  for (const sg of model.subgraphs) {
    for (const id of sg.nodeIds) subgraphNodeIds.add(id);

    const label = sg.label ? `["${escapeQuotes(sg.label)}"]` : "";
    lines.push(`  subgraph ${sg.id}${label}`);
    for (const nodeId of sg.nodeIds) {
      const node = model.nodes.get(nodeId);
      if (node) lines.push(`    ${formatNode(node)}`);
    }
    lines.push(`  end`);
  }

  for (const edge of model.edges) {
    const fromNode = model.nodes.get(edge.from);
    const toNode = model.nodes.get(edge.to);

    const fromStr = fromNode ? formatNode(fromNode) : edge.from;
    const toStr = toNode ? formatNode(toNode) : edge.to;

    const arrowStr = edge.label
      ? `${edge.style}|"${escapeQuotes(edge.label)}"|`
      : edge.style;

    lines.push(`  ${fromStr} ${arrowStr} ${toStr}`);
  }

  return lines.join("\n");
}

function formatNode(node: FlowNode): string {
  if (!node.label || node.shape === "default") return node.id;
  const escaped = escapeQuotes(node.label);
  switch (node.shape) {
    case "rect":
      return `${node.id}["${escaped}"]`;
    case "round":
      return `${node.id}("${escaped}")`;
    case "stadium":
      return `${node.id}(["${escaped}"])`;
    case "diamond":
      return `${node.id}{"${escaped}"}`;
    case "hexagon":
      return `${node.id}{{"${escaped}"}}`;
    case "circle":
      return `${node.id}(("${escaped}"))`;
    default:
      return `${node.id}["${escaped}"]`;
  }
}

export const flowchartRebuilderPass = {
  name: "flowchart-rebuilder",
  appliesTo: ["flowchart"] as DiagramKind[],
  isRebuilder: true,

  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const model = parseLooseFlowchart(code);

    if (!model) {
      return { passName: this.name, changed: false, code, repairs: [] };
    }

    const rebuilt = buildFlowchart(model);
    const changed = rebuilt !== code;

    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt flowchart (${model.nodes.size} nodes, ${model.edges.length} edges, direction: ${model.direction})`,
          ]
        : [],
    };
  },
};

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "").trim();
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}
