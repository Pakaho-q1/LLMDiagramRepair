import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface QuadrantPoint {
  name: string;
  x: number;
  y: number;
}
interface QuadrantModel {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
  points: QuadrantPoint[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function parseLooseQuadrant(code: string): QuadrantModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isQuad =
    /^(quadrantChart|quadrant|QuadrantChart|Quadrant Chart|quadrant[-_]chart|bcgMatrix|bcg[-_]matrix|matrixDiagram|priorityMatrix|scatterPlot)/i.test(
      lines[0],
    );
  if (!isQuad) return null;

  const model: QuadrantModel = {
    title: "",
    xAxisLabel: "",
    yAxisLabel: "",
    points: [],
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%")) continue;

    if (/^title\s+/i.test(line)) {
      model.title = line.replace(/^title\s+/i, "").trim();
      continue;
    }

    if (/^x-?axis\s+/i.test(line)) {
      const val = line.replace(/^x-?axis\s+/i, "").trim();
      model.xAxisLabel =
        stripQuotes(val.replace(/\s*-->\s*.+$/, "").trim()) +
        " --> " +
        stripQuotes(val.replace(/^.+\s*-->\s*/, "").trim());
      continue;
    }

    if (/^y-?axis\s+/i.test(line)) {
      const val = line.replace(/^y-?axis\s+/i, "").trim();
      model.yAxisLabel =
        stripQuotes(val.replace(/\s*-->\s*.+$/, "").trim()) +
        " --> " +
        stripQuotes(val.replace(/^.+\s*-->\s*/, "").trim());
      continue;
    }

    if (/^quadrant-1\s+/i.test(line)) {
      model.q1 = line.replace(/^quadrant-1\s+/i, "").trim();
      continue;
    }
    if (/^quadrant-2\s+/i.test(line)) {
      model.q2 = line.replace(/^quadrant-2\s+/i, "").trim();
      continue;
    }
    if (/^quadrant-3\s+/i.test(line)) {
      model.q3 = line.replace(/^quadrant-3\s+/i, "").trim();
      continue;
    }
    if (/^quadrant-4\s+/i.test(line)) {
      model.q4 = line.replace(/^quadrant-4\s+/i, "").trim();
      continue;
    }

    const pointMatch = line.match(
      /^([^:]+?)\s*:\s*[\[(]?\s*([\d.]+)\s*,\s*([\d.]+)\s*[\])]?$/,
    );
    if (pointMatch) {
      model.points.push({
        name: stripQuotes(pointMatch[1].trim()),
        x: clamp01(parseFloat(pointMatch[2])),
        y: clamp01(parseFloat(pointMatch[3])),
      });
      continue;
    }

    const loosePoint = line.match(/^([\w\s]+?)\s+([\d.]+)\s+([\d.]+)$/);
    if (loosePoint) {
      model.points.push({
        name: stripQuotes(loosePoint[1].trim()),
        x: clamp01(parseFloat(loosePoint[2])),
        y: clamp01(parseFloat(loosePoint[3])),
      });
    }
  }

  if (!model.points.length) return null;
  return model;
}

export function buildQuadrant(model: QuadrantModel): string {
  const lines = ["quadrantChart"];
  if (model.title) lines.push(`  title ${model.title}`);
  if (model.xAxisLabel) lines.push(`  x-axis ${model.xAxisLabel}`);
  if (model.yAxisLabel) lines.push(`  y-axis ${model.yAxisLabel}`);
  if (model.q1) lines.push(`  quadrant-1 ${model.q1}`);
  if (model.q2) lines.push(`  quadrant-2 ${model.q2}`);
  if (model.q3) lines.push(`  quadrant-3 ${model.q3}`);
  if (model.q4) lines.push(`  quadrant-4 ${model.q4}`);
  for (const p of model.points) {
    lines.push(`  ${p.name}: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}]`);
  }
  return lines.join("\n");
}

export const quadrantRebuilderPass = {
  name: "quadrant-rebuilder",
  isRebuilder: true,
  appliesTo: ["quadrantChart"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseQuadrant(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildQuadrant(model);
    const changed = rebuilt !== ctx.code;
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [`Rebuilt quadrantChart (${model.points.length} points)`]
        : [],
    };
  },
};
