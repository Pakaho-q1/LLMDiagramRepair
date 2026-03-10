// ============================================================
// rebuilders/flowchartRebuilder.ts
// Deterministic Rebuild สำหรับ Flowchart / Graph
// รองรับ loose format ที่ LLM มักสร้าง รวม graph TD, flowChart ฯลฯ
// ============================================================

import type { RepairContext, RepairResult } from '../types/index.js';

// ─────────────────────────────────────────────
// Data Model
// ─────────────────────────────────────────────

type NodeShape =
  | 'rect'       // [label]
  | 'round'      // (label)
  | 'stadium'    // ([label])
  | 'diamond'    // {label}
  | 'hexagon'    // {{label}}
  | 'circle'     // ((label))
  | 'default';

interface FlowNode {
  id: string;
  label?: string;
  shape: NodeShape;
}

type ArrowStyle = '-->' | '---' | '==>' | '-.->' | '-.->'; 

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
  direction: 'TD' | 'LR' | 'TB' | 'RL' | 'BT';
  nodes: Map<string, FlowNode>;
  edges: FlowEdge[];
  subgraphs: Subgraph[];
}

// ─────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────

export function parseLooseFlowchart(code: string): FlowchartModel | null {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  if (!lines.length) return null;

  const headerLine = lines[0].toLowerCase();
  const isFlowchart =
    /^(flowchart|graph|flow[-_]?chart|flow[-_]?diagram|network[-_]?diagram|process[-_]?diagram)/.test(
      headerLine,
    );

  // ── Headerless detection: ถ้าไม่มี keyword แต่ content ดูเหมือน flowchart ──
  const isHeaderless =
    !isFlowchart &&
    lines.some((l) => /^\w[\w\s]*\s*(-->|---|\|[^|])/.test(l) || /-->\s*\w/.test(l)) &&
    !lines.some((l) => /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|timeline)/i.test(l));

  if (!isFlowchart && !isHeaderless) return null;

  // ── Extract direction (จาก header ถ้ามี, ไม่งั้น default TD) ──
  const dirMatch = lines[0].match(/\b(TD|TB|LR|RL|BT)\b/i);
  const direction = (dirMatch?.[1]?.toUpperCase() ?? 'TD') as FlowchartModel['direction'];

  // ถ้า headerless ให้เริ่ม parse จาก line 0, ถ้ามี header ข้าม line 0
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

    // ── subgraph ─────────────────────────────
    const subgraphMatch = line.match(/^subgraph\s+(\w+)(?:\s*\[["']?(.+?)["']?\])?/i);
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

    // ── edge lines: A --> B, A -- label --> B, A -->|label| B ──
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

    // ── standalone node definition: A[label] ──
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

  // ต้องมี edge อย่างน้อย 1 เส้น ถึงถือว่าเป็น flowchart ที่ valid
  if (!model.edges.length && model.nodes.size < 2) return null;

  return model;
}

// ─────────────────────────────────────────────
// Edge Line Parser
// ─────────────────────────────────────────────

interface EdgeParseResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function parseEdgeLine(line: string): EdgeParseResult | null {
  // Pattern: NodeA[label] -->|edgeLabel| NodeB[label] --> NodeC
  // รองรับ chain: A --> B --> C

  // normalize over-extended arrows ก่อน parse
  const normalized = line
    .replace(/--{2,}>/g, '-->')
    .replace(/={3,}>/g, '==>')
    .replace(/\.-+>/g, '-.->');

  // ตรวจว่ามี arrow syntax หรือไม่
  if (!/-->|---|==>|-.->|\.\.\.>/.test(normalized)) return null;

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Split chain by arrow patterns — รักษา arrow type ไว้
  // Pattern เช่น: A --> B --> C  หรือ A -->|label| B --- C
  const ARROW_SPLIT = /(-->|---|==>|-\.->|\.\.\.>)(?:\|([^|]*)\|)?/g;

  // แยก segments ออกมา
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

  // Parse each part as node
  for (const part of parts) {
    if (!part) continue;
    const node = parseNodeDefinition(part);
    if (node) nodes.push(node);
  }

  // Create edges between consecutive nodes
  for (let i = 0; i < arrows.length; i++) {
    const fromPart = parts[i];
    const toPart = parts[i + 1];
    if (!fromPart || !toPart) continue;

    const fromNode = parseNodeDefinition(fromPart);
    const toNode = parseNodeDefinition(toPart);
    if (!fromNode || !toNode) continue;

    // ตรวจ inline edge label: A -- "label" --> B
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

// ─────────────────────────────────────────────
// Node Definition Parser
// ─────────────────────────────────────────────

function parseNodeDefinition(raw: string): FlowNode | null {
  const s = raw.trim();
  if (!s) return null;

  // id((label)) — circle
  let m = s.match(/^(\w[\w-]*)(?:\s*\(\((.+?)\)\))?$/);
  if (m && m[2]) return { id: m[1], label: stripQuotes(m[2]), shape: 'circle' };

  // id([label]) — stadium
  m = s.match(/^(\w[\w-]*)(?:\s*\(\[(.+?)\]\))?$/);
  if (m && m[2]) return { id: m[1], label: stripQuotes(m[2]), shape: 'stadium' };

  // id{{label}} — hexagon
  m = s.match(/^(\w[\w-]*)\s*\{\{(.+?)\}\}$/);
  if (m) return { id: m[1], label: stripQuotes(m[2]), shape: 'hexagon' };

  // id{label} — diamond
  m = s.match(/^(\w[\w-]*)\s*\{(.+?)\}$/);
  if (m) return { id: m[1], label: stripQuotes(m[2]), shape: 'diamond' };

  // id[label] — rect
  m = s.match(/^(\w[\w-]*)\s*\[(.+?)\]$/);
  if (m) return { id: m[1], label: stripQuotes(m[2]), shape: 'rect' };

  // id(label) — round
  m = s.match(/^(\w[\w-]*)\s*\((.+?)\)$/);
  if (m) return { id: m[1], label: stripQuotes(m[2]), shape: 'round' };

  // bare id (no shape declaration)
  m = s.match(/^(\w[\w-]*)$/);
  if (m) return { id: m[1], label: undefined, shape: 'default' };

  return null;
}

// ─────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────

export function buildFlowchart(model: FlowchartModel): string {
  const lines: string[] = [`flowchart ${model.direction}`];

  // ── Node definitions (ที่มี label เท่านั้น — bare nodes ไม่ต้องประกาศแยก) ──
  const nodesInEdges = new Set<string>();
  for (const edge of model.edges) {
    nodesInEdges.add(edge.from);
    nodesInEdges.add(edge.to);
  }

  for (const [id, node] of model.nodes) {
    // ถ้า node ไม่อยู่ใน edge เลย และมี label → ต้องประกาศแยก
    if (!nodesInEdges.has(id) && node.label) {
      lines.push(`  ${formatNode(node)}`);
    }
  }

  // ── Subgraphs ────────────────────────────────
  const subgraphNodeIds = new Set<string>();
  for (const sg of model.subgraphs) {
    for (const id of sg.nodeIds) subgraphNodeIds.add(id);

    const label = sg.label ? `["${escapeQuotes(sg.label)}"]` : '';
    lines.push(`  subgraph ${sg.id}${label}`);
    for (const nodeId of sg.nodeIds) {
      const node = model.nodes.get(nodeId);
      if (node) lines.push(`    ${formatNode(node)}`);
    }
    lines.push(`  end`);
  }

  // ── Edges ────────────────────────────────────
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

  return lines.join('\n');
}

function formatNode(node: FlowNode): string {
  if (!node.label || node.shape === 'default') return node.id;
  const escaped = escapeQuotes(node.label);
  switch (node.shape) {
    case 'rect':    return `${node.id}["${escaped}"]`;
    case 'round':   return `${node.id}("${escaped}")`;
    case 'stadium': return `${node.id}(["${escaped}"])`;
    case 'diamond': return `${node.id}{"${escaped}"}`;
    case 'hexagon': return `${node.id}{{"${escaped}"}}`;
    case 'circle':  return `${node.id}(("${escaped}"))`;
    default:        return `${node.id}["${escaped}"]`;
  }
}

// ─────────────────────────────────────────────
// Repair Pass
// ─────────────────────────────────────────────

export const flowchartRebuilderPass = {
  name: 'flowchart-rebuilder',
  appliesTo: ['flowchart'] as DiagramKind[],
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

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '').trim();
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}
