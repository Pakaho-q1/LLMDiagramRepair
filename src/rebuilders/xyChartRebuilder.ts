// ============================================================
// rebuilders/xyChartRebuilder.ts
// Deterministic Rebuild สำหรับ xychart-beta
// รองรับ lineChart, barChart, และ hallucinated variants ทั้งหมด
// ============================================================

import type { RepairContext, RepairResult } from '../types/index.js';

// ─────────────────────────────────────────────
// Internal Data Model
// ─────────────────────────────────────────────

type SeriesType = 'line' | 'bar';

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

// ─────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────

/**
 * Parse loose XY chart syntax ที่ LLM สร้าง
 * รองรับทุก variant ที่เคยพบ
 */
export function parseLooseXYChart(code: string): XYChartModel | null {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  // ── ตรวจ keyword บรรทัดแรก ──────────────────
  const headerLine = lines[0].toLowerCase();
  const isXYVariant =
    /^(xychart(-beta)?|line[-_]?chart|line[-_]?graph|linechart|bar[-_]?chart|bar[-_]?graph|barchart|column[-_]?chart|area[-_]?chart|chartline|chartbar)/.test(
      headerLine,
    );
  if (!isXYVariant) return null;

  // ── ตรวจว่า default series type คืออะไร ────────
  const defaultType: SeriesType =
    /^(bar[-_]?chart|barchart|bargraph|column[-_]?chart)/i.test(lines[0])
      ? 'bar'
      : 'line';

  // ── State machine parse ─────────────────────
  const model: XYChartModel = {
    title: '',
    xLabels: [],
    yLabel: '',
    series: [],
  };

  let currentSeries: XYSeries | null = null;
  const xLabelsFirstSeries: string[] = [];
  let inDataBlock = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // title
    if (/^title\s+/i.test(line)) {
      model.title = stripQuotes(line.replace(/^title\s+/i, '').trim());
      continue;
    }

    // x-axis: อาจเป็น label string, JSON array, หรือ range
    if (/^x-?axis\s+/i.test(line)) {
      const val = line.replace(/^x-?axis\s+/i, '').trim();
      const parsed = tryParseAxisList(val);
      if (parsed) model.xLabels = parsed;
      // ถ้า parse ไม่ได้ → เก็บเป็น label เดียว (จะ override ด้วย data labels)
      continue;
    }

    // y-axis: อาจมี min/max suffix → "กำไร (ล้านบาท) 0 --> 100"
    if (/^y-?axis\s+/i.test(line)) {
      const val = line.replace(/^y-?axis\s+/i, '').trim();
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

    // series "name" หรือ series name หรือ line "name" หรือ bar "name"
    const seriesMatch = line.match(
      /^(series|line|bar|area|column)\s+["']?(.+?)["']?$/i,
    );
    if (seriesMatch) {
      if (currentSeries) model.series.push(currentSeries);
      const typeHint = seriesMatch[1].toLowerCase();
      // 'series' keyword → ใช้ defaultType จาก header (barChart=bar, lineChart=line)
      const seriesType: SeriesType =
        typeHint === 'series'
          ? defaultType
          : typeHint === 'bar' || typeHint === 'column'
            ? 'bar'
            : 'line';
      currentSeries = {
        name: stripQuotes(seriesMatch[2]),
        type: seriesType,
        values: [],
      };
      inDataBlock = true;
      continue;
    }

    // xychart-beta native data:  bar [1,2,3]  หรือ  line [1,2,3]
    const nativeDataMatch = line.match(/^(bar|line)\s+(\[[\d.,\s]+\])/i);
    if (nativeDataMatch) {
      const vals = parseNumberArray(nativeDataMatch[2]);
      if (vals) {
        if (currentSeries) model.series.push(currentSeries);
        currentSeries = {
          name:
            nativeDataMatch[1].toLowerCase() === 'bar' ? 'ข้อมูล' : 'ข้อมูล',
          type: nativeDataMatch[1].toLowerCase() as SeriesType,
          values: vals,
        };
        model.series.push(currentSeries);
        currentSeries = null;
      }
      continue;
    }

    // JSON array (bare): [1, 2, 3, 4]
    if (/^\[[\d.,\s]+\]$/.test(line)) {
      const vals = parseNumberArray(line);
      if (vals) {
        if (!currentSeries) {
          currentSeries = { name: 'ข้อมูล', type: defaultType, values: [] };
        }
        currentSeries.values = vals;
        model.series.push(currentSeries);
        currentSeries = null;
      }
      continue;
    }

    // data point: "label" : value  หรือ  label : value  หรือ  N : value
    const kvMatch = line.match(/^["']?(.+?)["']?\s*:\s*([\d.]+)\s*$/);
    if (kvMatch) {
      const label = kvMatch[1].trim();
      const value = Number(kvMatch[2]);

      // ถ้ายังไม่มี series → สร้าง implicit series
      if (!currentSeries) {
        currentSeries = { name: 'ข้อมูล', type: defaultType, values: [] };
        inDataBlock = true;
      }

      // เก็บ x-label จาก series แรกเท่านั้น
      if (model.series.length === 0) {
        xLabelsFirstSeries.push(label);
      }

      currentSeries.values.push(value);
      continue;
    }

    // bare number
    if (/^[\d.]+$/.test(line) && inDataBlock && currentSeries) {
      currentSeries.values.push(Number(line));
      continue;
    }
  }

  // flush series สุดท้าย
  if (currentSeries && currentSeries.values.length > 0) {
    model.series.push(currentSeries);
  }

  if (!model.series.length) return null;

  // ── Resolve x-labels ────────────────────────
  const valueCount = model.series[0].values.length;

  if (!model.xLabels.length) {
    // ใช้ label จากข้อมูล ถ้ามีครบ
    if (xLabelsFirstSeries.length === valueCount) {
      model.xLabels = xLabelsFirstSeries;
    } else {
      // auto-generate
      model.xLabels = Array.from({ length: valueCount }, (_, i) =>
        String(i + 1),
      );
    }
  }

  return model;
}

// ─────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────

/**
 * สร้าง xychart-beta code จาก XYChartModel
 */
export function buildXYChart(model: XYChartModel): string {
  const lines: string[] = ['xychart-beta'];

  if (model.title) {
    lines.push(`  title "${escapeQuotes(model.title)}"`);
  }

  lines.push(`  x-axis ${JSON.stringify(model.xLabels)}`);

  if (model.yLabel) {
    if (model.yMin !== undefined && model.yMax !== undefined) {
      lines.push(
        `  y-axis "${escapeQuotes(model.yLabel)}" ${model.yMin} --> ${model.yMax}`,
      );
    } else {
      lines.push(`  y-axis "${escapeQuotes(model.yLabel)}"`);
    }
  }

  for (const s of model.series) {
    lines.push(`  ${s.type} ${JSON.stringify(s.values)}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Repair Pass (Plugin Interface)
// ─────────────────────────────────────────────

export const xyChartRebuilderPass = {
  name: 'xy-chart-rebuilder',
  appliesTo: ['xychart-beta'] as const,
  isRebuilder: true,

  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const repairs: string[] = [];

    const model = parseLooseXYChart(code);

    if (!model) {
      return { passName: this.name, changed: false, code, repairs };
    }

    const rebuilt = buildXYChart(model);

    if (rebuilt !== code) {
      repairs.push(
        `Rebuilt xychart-beta from loose syntax (${model.series.length} series, ${model.xLabels.length} x-points)`,
      );
    }

    return {
      passName: this.name,
      changed: rebuilt !== code,
      code: rebuilt,
      repairs,
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

function tryParseAxisList(val: string): string[] | null {
  // JSON array: ["Q1","Q2"]
  try {
    const arr = JSON.parse(val);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {}

  // Comma-separated: Q1, Q2, Q3
  if (val.includes(',')) {
    return val
      .split(',')
      .map((s) => stripQuotes(s.trim()))
      .filter(Boolean);
  }

  return null;
}

function parseNumberArray(s: string): number[] | null {
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr) && arr.every((x) => typeof x === 'number')) {
      return arr;
    }
  } catch {}
  return null;
}
