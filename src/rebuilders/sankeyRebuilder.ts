import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface SankeyFlow {
  source: string;
  target: string;
  value: number;
}
interface SankeyModel {
  flows: SankeyFlow[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

export function parseLooseSankey(code: string): SankeyModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isSankey =
    /^(sankey(-beta)?|Sankey|sankey[-_]chart|sankeyDiagram)/i.test(lines[0]);
  if (!isSankey) return null;

  const model: SankeyModel = { flows: [] };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%")) continue;

    const csvMatch = line.match(/^([^,→\-]+),([^,]+),([\d.]+)$/);
    if (csvMatch) {
      model.flows.push({
        source: stripQuotes(csvMatch[1].trim()),
        target: stripQuotes(csvMatch[2].trim()),
        value: parseFloat(csvMatch[3]),
      });
      continue;
    }

    const arrowMatch = line.match(
      /^(.+?)\s*(?:-->|->|→|-+>)\s*(.+?)\s*[：:,\s]\s*([\d.]+)\s*$/,
    );
    if (arrowMatch) {
      model.flows.push({
        source: stripQuotes(arrowMatch[1].trim()),
        target: stripQuotes(arrowMatch[2].trim()),
        value: parseFloat(arrowMatch[3]),
      });
      continue;
    }

    const bracketMatch = line.match(/^(.+?)\s*\[([\d.]+)\]\s*(.+)$/);
    if (bracketMatch) {
      model.flows.push({
        source: stripQuotes(bracketMatch[1].trim()),
        target: stripQuotes(bracketMatch[3].trim()),
        value: parseFloat(bracketMatch[2]),
      });
      continue;
    }

    const dashMatch = line.match(/^(.+?)\s*-\s*([\d.]+)\s*-+>\s*(.+)$/);
    if (dashMatch) {
      model.flows.push({
        source: stripQuotes(dashMatch[1].trim()),
        target: stripQuotes(dashMatch[3].trim()),
        value: parseFloat(dashMatch[2]),
      });
      continue;
    }
  }

  if (!model.flows.length) return null;
  return model;
}

export function buildSankey(model: SankeyModel): string {
  const lines = ["sankey-beta"];
  for (const flow of model.flows) {
    lines.push(`${flow.source},${flow.target},${flow.value}`);
  }
  return lines.join("\n");
}

export const sankeyRebuilderPass = {
  name: "sankey-rebuilder",
  isRebuilder: true,
  appliesTo: ["sankey-beta"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseSankey(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildSankey(model);
    const changed = rebuilt !== ctx.code;
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [`Rebuilt sankey-beta (${model.flows.length} flows)`]
        : [],
    };
  },
};
