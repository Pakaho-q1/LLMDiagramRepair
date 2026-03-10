import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

type SeriesType = "line" | "bar";

interface XYSeries {
  name: string;
  type: SeriesType;
  values: number[];
}
interface XYChartModel {
  title: string;
  xLabels: string[];
  yLabel: string;
  yMin?: number;
  yMax?: number;
  series: XYSeries[];
}

export function parseLooseXYChart(code: string): XYChartModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const headerLine = lines[0].toLowerCase();
  const isXYVariant =
    /^(xychart(-beta)?|line[-_]?chart|line[-_]?graph|linechart|bar[-_]?chart|bar[-_]?graph|barchart|column[-_]?chart|area[-_]?chart|chartline|chartbar)/.test(
      headerLine,
    );
  if (!isXYVariant) return null;

  const defaultType: SeriesType =
    /^(bar[-_]?chart|barchart|bargraph|column[-_]?chart)/i.test(lines[0])
      ? "bar"
      : "line";
  const model: XYChartModel = {
    title: "",
    xLabels: [],
    yLabel: "",
    series: [],
  };
  let currentSeries: XYSeries | null = null;
  const xLabelsFirstSeries: string[] = [];
  let inDataBlock = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^title\s+/i.test(line)) {
      model.title = stripQuotes(line.replace(/^title\s+/i, "").trim());
      continue;
    }
    if (/^x-?axis\s+/i.test(line)) {
      const val = line.replace(/^x-?axis\s+/i, "").trim();
      const parsed = tryParseAxisList(val);
      if (parsed) model.xLabels = parsed;
      continue;
    }
    if (/^y-?axis\s+/i.test(line)) {
      const val = line.replace(/^y-?axis\s+/i, "").trim();
      const rangeMatch = val.match(/^(.+?)\s+([\d.]+)\s*-->\s*([\d.]+)$/);
      if (rangeMatch) {
        model.yLabel = stripQuotes(rangeMatch[1]);
        model.yMin = Number(rangeMatch[2]);
        model.yMax = Number(rangeMatch[3]);
      } else {
        model.yLabel = stripQuotes(val);
      }
      continue;
    }
    const seriesMatch = line.match(
      /^(series|line|bar|area|column)\s+["']?(.+?)["']?$/i,
    );
    if (seriesMatch) {
      if (currentSeries) model.series.push(currentSeries);
      const typeHint = seriesMatch[1].toLowerCase();
      const seriesType: SeriesType =
        typeHint === "series"
          ? defaultType
          : typeHint === "bar" || typeHint === "column"
            ? "bar"
            : "line";
      currentSeries = {
        name: stripQuotes(seriesMatch[2]),
        type: seriesType,
        values: [],
      };
      inDataBlock = true;
      continue;
    }
    const nativeDataMatch = line.match(/^(bar|line)\s+(\[[\d.,\s]+\])/i);
    if (nativeDataMatch) {
      const vals = parseNumberArray(nativeDataMatch[2]);
      if (vals) {
        if (currentSeries) model.series.push(currentSeries);
        currentSeries = {
          name: "data",
          type: nativeDataMatch[1].toLowerCase() as SeriesType,
          values: vals,
        };
        model.series.push(currentSeries);
        currentSeries = null;
      }
      continue;
    }
    if (/^\[[\d.,\s]+\]$/.test(line)) {
      const vals = parseNumberArray(line);
      if (vals) {
        if (!currentSeries)
          currentSeries = { name: "data", type: defaultType, values: [] };
        currentSeries.values = vals;
        model.series.push(currentSeries);
        currentSeries = null;
      }
      continue;
    }
    const kvMatch = line.match(/^["']?(.+?)["']?\s*:\s*([\d.]+)\s*$/);
    if (kvMatch) {
      if (!currentSeries) {
        currentSeries = { name: "data", type: defaultType, values: [] };
        inDataBlock = true;
      }
      if (model.series.length === 0) xLabelsFirstSeries.push(kvMatch[1].trim());
      currentSeries.values.push(Number(kvMatch[2]));
      continue;
    }
    if (/^[\d.]+$/.test(line) && inDataBlock && currentSeries) {
      currentSeries.values.push(Number(line));
      continue;
    }
  }
  if (currentSeries && currentSeries.values.length > 0)
    model.series.push(currentSeries);
  if (!model.series.length) return null;
  const valueCount = model.series[0].values.length;
  if (!model.xLabels.length) {
    model.xLabels =
      xLabelsFirstSeries.length === valueCount
        ? xLabelsFirstSeries
        : Array.from({ length: valueCount }, (_, i) => String(i + 1));
  }
  return model;
}

export function buildXYChart(model: XYChartModel): string {
  const lines: string[] = ["xychart-beta"];
  if (model.title) lines.push(`  title "${escapeQuotes(model.title)}"`);
  lines.push(`  x-axis ${JSON.stringify(model.xLabels)}`);
  if (model.yLabel) {
    if (model.yMin !== undefined && model.yMax !== undefined)
      lines.push(
        `  y-axis "${escapeQuotes(model.yLabel)}" ${model.yMin} --> ${model.yMax}`,
      );
    else lines.push(`  y-axis "${escapeQuotes(model.yLabel)}"`);
  }
  for (const s of model.series)
    lines.push(`  ${s.type} ${JSON.stringify(s.values)}`);
  return lines.join("\n");
}

export const xyChartRebuilderPass = {
  name: "xy-chart-rebuilder",
  appliesTo: ["xychart-beta"] as DiagramKind[],
  isRebuilder: true,
  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const repairs: string[] = [];
    const model = parseLooseXYChart(code);
    if (!model) return { passName: this.name, changed: false, code, repairs };
    const rebuilt = buildXYChart(model);
    if (rebuilt !== code)
      repairs.push(
        `Rebuilt xychart-beta (${model.series.length} series, ${model.xLabels.length} x-points)`,
      );
    return {
      passName: this.name,
      changed: rebuilt !== code,
      code: rebuilt,
      repairs,
    };
  },
};

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "").trim();
}
function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}
function tryParseAxisList(val: string): string[] | null {
  try {
    const arr = JSON.parse(val);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {}
  if (val.includes(","))
    return val
      .split(",")
      .map((s) => stripQuotes(s.trim()))
      .filter(Boolean);
  return null;
}
function parseNumberArray(s: string): number[] | null {
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "number"))
      return arr;
  } catch {}
  return null;
}
