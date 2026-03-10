// ============================================================
// rebuilders/pieRebuilder.ts
// Deterministic Rebuild สำหรับ Pie Chart
// ============================================================

import type { RepairContext, RepairResult } from '../types/index.js';

interface PieSlice {
  label: string;
  value: number;
}

interface PieModel {
  title: string;
  showData: boolean;
  slices: PieSlice[];
}

export function parseLoosePie(code: string): PieModel | null {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const header = lines[0].toLowerCase();
  const isPie = /^(pie|piechart|pie[-_]?chart|donut|donutchart)/i.test(header);
  if (!isPie) return null;

  const model: PieModel = {
    title: '',
    showData: /showdata/i.test(lines[0]),
    slices: [],
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (/^title\s+/i.test(line)) {
      model.title = line
        .replace(/^title\s+/i, '')
        .trim()
        .replace(/^["']|["']$/g, '');
      continue;
    }

    // "Label" : value  หรือ  Label : value
    const sliceMatch = line.match(/^["']?(.+?)["']?\s*:\s*([\d.]+)\s*$/);
    if (sliceMatch) {
      model.slices.push({
        label: sliceMatch[1].trim(),
        value: Number(sliceMatch[2]),
      });
    }
  }

  if (!model.slices.length) return null;
  return model;
}

export function buildPie(model: PieModel): string {
  const lines: string[] = [model.showData ? 'pie showData' : 'pie'];
  if (model.title) {
    lines.push(`  title ${model.title}`);
  }
  for (const s of model.slices) {
    lines.push(`  "${s.label}" : ${s.value}`);
  }
  return lines.join('\n');
}

export const pieRebuilderPass = {
  name: 'pie-rebuilder',
  appliesTo: ['pie'] as const,
  isRebuilder: true,

  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const model = parseLoosePie(code);

    if (!model) {
      return { passName: this.name, changed: false, code, repairs: [] };
    }

    const rebuilt = buildPie(model);
    const changed = rebuilt !== code;

    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt pie chart (${model.slices.length} slices${model.title ? `, title: "${model.title}"` : ''})`,
          ]
        : [],
    };
  },
};
