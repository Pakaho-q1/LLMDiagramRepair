import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface StateNode {
  id: string;
  label?: string;
  type: "normal" | "start" | "end" | "fork" | "join" | "choice" | "note";
}
interface StateTransition {
  from: string;
  to: string;
  label?: string;
}
interface StateConcurrent {
  states: string[];
}
interface StateComposite {
  id: string;
  label?: string;
  children: StateModel;
}
interface StateModel {
  nodes: Map<string, StateNode>;
  transitions: StateTransition[];
  composites: StateComposite[];
  notes: { text: string; target?: string }[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}
function makeModel(): StateModel {
  return { nodes: new Map(), transitions: [], composites: [], notes: [] };
}

function ensureNode(
  model: StateModel,
  id: string,
  label?: string,
  type: StateNode["type"] = "normal",
) {
  if (id === "[*]") return;
  if (!model.nodes.has(id))
    model.nodes.set(id, { id, label: label ?? id, type });
  else if (label) model.nodes.get(id)!.label = label;
}

export function parseLooseState(code: string): StateModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isState =
    /^(stateDiagram(-v2)?|statediagram|state[-_]diagram|StateDiagram|State Diagram|fsm|statemachine)/i.test(
      lines[0],
    );
  if (!isState) return null;

  const model = makeModel();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%")) continue;

    const transMatch = line.match(
      /^(\[?\*?\]?[\w\s.]+?)\s*-{1,2}>\s*(\[?\*?\]?[\w\s.]+?)(?:\s*:\s*(.+))?$/,
    );
    if (transMatch) {
      const from = transMatch[1].trim();
      const to = transMatch[2].trim();
      const label = transMatch[3]?.trim();
      model.transitions.push({ from, to, label });
      ensureNode(model, from);
      ensureNode(model, to);
      continue;
    }

    const stateAsMatch = line.match(/^state\s+"([^"]+)"\s+as\s+(\w+)/i);
    if (stateAsMatch) {
      ensureNode(model, stateAsMatch[2], stateAsMatch[1]);
      continue;
    }

    const forkMatch = line.match(/^state\s+(\w+)\s+<<(fork|join|choice)>>/i);
    if (forkMatch) {
      ensureNode(
        model,
        forkMatch[1],
        forkMatch[1],
        forkMatch[2].toLowerCase() as StateNode["type"],
      );
      continue;
    }

    const noteMatch = line.match(
      /^note\s+(?:right|left|top|bottom)?\s*of\s+(\w+)\s*:\s*(.+)/i,
    );
    if (noteMatch) {
      model.notes.push({ target: noteMatch[1], text: noteMatch[2] });
      continue;
    }

    const bareMatch = line.match(/^(\w[\w\s]*)$/);
    if (bareMatch && !["end", "state"].includes(bareMatch[1].toLowerCase())) {
      ensureNode(model, bareMatch[1]);
    }
  }

  if (!model.transitions.length && !model.nodes.size) return null;
  return model;
}

export function buildState(model: StateModel): string {
  const lines = ["stateDiagram-v2"];

  for (const node of model.nodes.values()) {
    if (node.type === "fork" || node.type === "join")
      lines.push(`  state ${node.id} <<${node.type}>>`);
    else if (node.type === "choice")
      lines.push(`  state ${node.id} <<choice>>`);
    else if (node.label && node.label !== node.id)
      lines.push(`  state "${node.label}" as ${node.id}`);
  }

  for (const t of model.transitions) {
    const arrow = t.label
      ? `${t.from} --> ${t.to} : ${t.label}`
      : `${t.from} --> ${t.to}`;
    lines.push(`  ${arrow}`);
  }

  for (const n of model.notes) {
    if (n.target) lines.push(`  note right of ${n.target} : ${n.text}`);
  }

  return lines.join("\n");
}

export const stateRebuilderPass = {
  name: "state-rebuilder",
  isRebuilder: true,
  appliesTo: ["stateDiagram-v2"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseState(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildState(model);
    const changed = rebuilt !== ctx.code;
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt stateDiagram-v2 (${model.nodes.size} states, ${model.transitions.length} transitions)`,
          ]
        : [],
    };
  },
};
