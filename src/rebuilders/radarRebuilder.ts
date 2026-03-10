import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface RadarAxis {
  label: string;
}

interface RadarSeries {
  label: string;
  values: number[];
}

interface RadarModel {
  title: string;
  axes: RadarAxis[];
  series: RadarSeries[];
  max?: number;
}

function stripQuotes(s: string): string {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

function parseNumberList(raw: string): number[] {
  return raw
    .replace(/[\[\]]/g, "")
    .split(/[,\s]+/)
    .map((v) => parseFloat(v.trim()))
    .filter((v) => !isNaN(v));
}

function parseAxisList(raw: string): string[] {
  const cleaned = raw.replace(/^\[|\]$/g, "").trim();
  const sep = cleaned.includes(",") ? "," : /[/|]/.test(cleaned) ? /[/|]/ : ",";
  return cleaned
    .split(sep)
    .map((v) => stripQuotes(v.trim()))
    .filter(Boolean);
}

export function parseLooseRadar(code: string): RadarModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const isRadarVariant =
    /^(radar(-beta)?|radarchart|radar[-_]chart|spiderchart|spider[-_]chart|spiderweb|spider[-_]web|polarchart|polar[-_]chart|performanceradar|skillradar|competencychart|competency[-_]chart)/i.test(
      lines[0],
    );
  if (!isRadarVariant) return null;

  const model: RadarModel = { title: "", axes: [], series: [] };

  let pendingAxes: string[] = [];
  let pendingLabel = "Data";

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (/^title\s+/i.test(line)) {
      model.title = stripQuotes(line.replace(/^title\s+/i, "").trim());
      continue;
    }

    if (/^(max|range|scale)\s+[\d.]+/i.test(line)) {
      const m = line.match(/[\d.]+/);
      if (m) model.max = parseFloat(m[0]);
      continue;
    }

    if (/^axis(?:es)?\s*[:：]?\s*/i.test(line)) {
      const raw = line.replace(/^axis(?:es)?\s*[:：]?\s*/i, "").trim();
      pendingAxes = parseAxisList(raw);
      model.axes = pendingAxes.map((label) => ({ label }));
      continue;
    }

    if (/^(value|values|data|score|scores|v)\s*[:：]?\s*[\d]/i.test(line)) {
      const raw = line
        .replace(/^(value|values|data|score|scores|v)\s*[:：]?\s*/i, "")
        .trim();
      const vals = parseNumberList(raw);
      if (vals.length) {
        model.series.push({ label: pendingLabel, values: vals });
      }
      continue;
    }

    const namedSeriesMatch = line.match(
      /^["']?([^"':,]+?)["']?\s*[:：]\s*([\d,.\s]+)$/,
    );
    if (namedSeriesMatch) {
      const label = namedSeriesMatch[1].trim();
      const vals = parseNumberList(namedSeriesMatch[2]);
      if (vals.length) {
        model.series.push({ label, values: vals });
      }
      continue;
    }

    const rawNums = parseNumberList(line);
    if (rawNums.length >= 2 && !/^(axis|title|max)/i.test(line)) {
      model.series.push({ label: pendingLabel, values: rawNums });
      continue;
    }

    if (/^["']?[\w\s]+["']?$/.test(line) && !/^(end|subgraph)/i.test(line)) {
      pendingLabel = stripQuotes(line);
    }
  }

  if (!model.axes.length && model.series.length) {
    const maxLen = Math.max(...model.series.map((s) => s.values.length));
    model.axes = Array.from({ length: maxLen }, (_, i) => ({
      label: `Axis${i + 1}`,
    }));
  }

  if (!model.axes.length || !model.series.length) return null;

  return model;
}

export function buildRadar(model: RadarModel): string {
  const lines: string[] = ["radar-beta"];

  if (model.title) {
    lines.push(`  title ${model.title}`);
  }

  if (model.max !== undefined) {
    lines.push(`  max ${model.max}`);
  }

  const axisLine = model.axes
    .map((a) => `"${a.label.replace(/"/g, '\\"')}"`)
    .join(", ");
  lines.push(`  axis ${axisLine}`);

  for (const s of model.series) {
    const vals = [...s.values];
    while (vals.length < model.axes.length) vals.push(0);
    vals.length = model.axes.length;

    const valLine = vals.join(", ");
    lines.push(`  "${s.label}" : [${valLine}]`);
  }

  return lines.join("\n");
}

export const radarRebuilderPass = {
  name: "radar-rebuilder",
  isRebuilder: true,
  appliesTo: ["radar-beta"] as DiagramKind[],

  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const model = parseLooseRadar(code);

    if (!model) {
      return { passName: this.name, changed: false, code, repairs: [] };
    }

    const rebuilt = buildRadar(model);
    const changed = rebuilt !== code;

    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt radar-beta (${model.axes.length} axes, ${model.series.length} series${
              model.title ? `, title: "${model.title}"` : ""
            })`,
          ]
        : [],
    };
  },
};
