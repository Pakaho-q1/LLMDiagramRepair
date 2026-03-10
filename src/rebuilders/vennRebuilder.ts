// ============================================================
// rebuilders/vennRebuilder.ts
// Deterministic Rebuild สำหรับ venn-beta
// รองรับ loose format ที่ LLM มักสร้าง
// ============================================================

import type { RepairContext, RepairResult } from '../types/index.js';

// ─────────────────────────────────────────────
// Data Model
// ─────────────────────────────────────────────

interface VennSet {
  id: string;
  label?: string;
  size?: number;
  texts: string[];
  style?: string;
}

interface VennUnion {
  ids: string[];
  label?: string;
  size?: number;
  texts: string[];
  style?: string;
}

interface VennModel {
  sets: VennSet[];
  unions: VennUnion[];
}

// ─────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────

export function parseLooseVenn(code: string): VennModel | null {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const header = lines[0].toLowerCase();
  const isVenn = /^(venn(-beta)?|venn\s*diagram|overlap|set[-_]?diagram)/i.test(
    header,
  );
  if (!isVenn) return null;

  const model: VennModel = { sets: [], unions: [] };
  let currentContext: VennSet | VennUnion | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // ── set A  หรือ  set A["Label"]  หรือ  set A : N ──
    const setMatch = line.match(
      /^set\s+(\w+)(?:\s*\["([^"]+)"\])?(?:\s*:\s*([\d.]+))?/i,
    );
    if (setMatch) {
      currentContext = {
        id: setMatch[1],
        label: setMatch[2],
        size: setMatch[3] ? Number(setMatch[3]) : undefined,
        texts: [],
      };
      model.sets.push(currentContext as VennSet);
      continue;
    }

    // ── union A B  หรือ  union A B["Label"]  หรือ  intersection A B ──
    const unionMatch = line.match(
      /^(?:union|intersection|overlap)\s+([\w\s]+?)(?:\s*\["([^"]+)"\])?(?:\s*:\s*([\d.]+))?$/i,
    );
    if (unionMatch) {
      const ids = unionMatch[1].trim().split(/\s+/);
      currentContext = {
        ids,
        label: unionMatch[2],
        size: unionMatch[3] ? Number(unionMatch[3]) : undefined,
        texts: [],
      };
      model.unions.push(currentContext as VennUnion);
      continue;
    }

    // ── Loose format: "A ∩ B" หรือ "A AND B" หรือ "A & B" ──
    const looseUnionMatch = line.match(
      /^(\w+)\s*(?:∩|AND|&|\+)\s*(\w+)(?:\s*:\s*([\d.]+))?/i,
    );
    if (looseUnionMatch) {
      const u: VennUnion = {
        ids: [looseUnionMatch[1], looseUnionMatch[2]],
        size: looseUnionMatch[3] ? Number(looseUnionMatch[3]) : undefined,
        texts: [],
      };
      model.unions.push(u);
      currentContext = u;
      continue;
    }

    // ── Loose "circle" format: circle A "Label" ──
    const circleMatch = line.match(/^circle\s+(\w+)\s*["']?(.+?)["']?$/i);
    if (circleMatch) {
      const s: VennSet = {
        id: circleMatch[1],
        label: circleMatch[2],
        texts: [],
      };
      model.sets.push(s);
      currentContext = s;
      continue;
    }

    // ── text "content" ──
    const textMatch = line.match(
      /^text\s+(?:\["([^"]+)"\]|["'](.+?)["']|(.+))$/i,
    );
    if (textMatch && currentContext) {
      const txt = textMatch[1] ?? textMatch[2] ?? textMatch[3];
      currentContext.texts.push(txt.trim());
      continue;
    }

    // ── style ──
    const styleMatch = line.match(/^style\s+/i);
    if (styleMatch && currentContext) {
      currentContext.style = line;
      continue;
    }

    // ── Bare label under set (indented text line) ──
    if (currentContext && !/^(set|union|circle|text|style)\s/i.test(line)) {
      // อาจเป็น implicit text
      currentContext.texts.push(stripQuotes(line));
    }
  }

  if (!model.sets.length) return null;
  return model;
}

// ─────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────

export function buildVenn(model: VennModel): string {
  const lines: string[] = ['venn-beta'];

  for (const s of model.sets) {
    let line = `  set ${s.id}`;
    if (s.label) line += `["${escapeQuotes(s.label)}"]`;
    if (s.size !== undefined) line += `:${s.size}`;
    lines.push(line);
    for (const t of s.texts) {
      lines.push(`    text "${escapeQuotes(t)}"`);
    }
    if (s.style) lines.push(`  ${s.style}`);
  }

  for (const u of model.unions) {
    let line = `  union ${u.ids.join(' ')}`;
    if (u.label) line += `["${escapeQuotes(u.label)}"]`;
    if (u.size !== undefined) line += `:${u.size}`;
    lines.push(line);
    for (const t of u.texts) {
      lines.push(`    text "${escapeQuotes(t)}"`);
    }
    if (u.style) lines.push(`  ${u.style}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Repair Pass
// ─────────────────────────────────────────────

export const vennRebuilderPass = {
  name: 'venn-rebuilder',
  appliesTo: ['venn-beta'] as const,
  isRebuilder: true,

  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const model = parseLooseVenn(code);

    if (!model) {
      return { passName: this.name, changed: false, code, repairs: [] };
    }

    const rebuilt = buildVenn(model);
    const changed = rebuilt !== code;

    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt venn-beta (${model.sets.length} sets, ${model.unions.length} unions)`,
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
