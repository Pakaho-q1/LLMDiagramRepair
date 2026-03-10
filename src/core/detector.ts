import type { DetectionResult, DiagramKind } from '../types/index.js';
import { ALIAS_TO_CANONICAL, DIAGRAM_REGISTRY } from './registry.js';

const SORTED_CANDIDATES: Array<{ lower: string; canonical: string }> = [];

for (const entry of DIAGRAM_REGISTRY) {
  const all = [entry.keyword, ...entry.aliases];
  for (const alias of all) {
    SORTED_CANDIDATES.push({
      lower: alias.toLowerCase(),
      canonical: entry.keyword,
    });
  }
}

SORTED_CANDIDATES.sort((a, b) => b.lower.length - a.lower.length);

interface Heuristic {
  kind: DiagramKind;
  canonical: string;
  test: (lines: string[]) => boolean;
}

const STRUCTURAL_HEURISTICS: Heuristic[] = [
  {
    kind: 'flowchart',
    canonical: 'flowchart',

    test: (lines) =>
      lines.some((l) => /\w+\s*(-->|---|\|[^|]|\[\[|\(\()/.test(l)),
  },
  {
    kind: 'sequenceDiagram',
    canonical: 'sequenceDiagram',

    test: (lines) =>
      lines.some((l) => /^(participant|actor|note|loop|alt|opt)\s/i.test(l)) ||
      lines.some((l) => /\w+\s*->?>?\s*\w+\s*:/.test(l)),
  },
  {
    kind: 'classDiagram',
    canonical: 'classDiagram',
    test: (lines) =>
      lines.some((l) => /^class\s+\w+/.test(l)) ||
      lines.some((l) => /(<\|--|--\|>|<\|\.\.|\.\.\|>|--o|o--)/.test(l)),
  },
  {
    kind: 'stateDiagram-v2',
    canonical: 'stateDiagram-v2',
    test: (lines) =>
      lines.some((l) => /^\[?\*\]?\s*-->/.test(l)) ||
      lines.some((l) => /^state\s+/.test(l)),
  },
  {
    kind: 'erDiagram',
    canonical: 'erDiagram',
    test: (lines) =>
      lines.some((l) => /\|[|o{]--[|o{]\|/.test(l)) ||
      lines.some((l) => /^[A-Z]+\s*\{/.test(l)),
  },
  {
    kind: 'gantt',
    canonical: 'gantt',
    test: (lines) =>
      lines.some((l) => /^section\s+/i.test(l)) &&
      lines.some((l) => /:\s*\d{4}-\d{2}-\d{2}/.test(l)),
  },
  {
    kind: 'pie',
    canonical: 'pie',
    test: (lines) =>
      lines.filter((l) => /^["']?.+["']?\s*:\s*[\d.]+/.test(l)).length >= 2 &&
      !lines.some((l) => /^(flowchart|graph|sequence)/i.test(l)),
  },
  {
    kind: 'xychart-beta',
    canonical: 'xychart-beta',
    test: (lines) =>
      lines.some((l) => /^(x-axis|y-axis)\s/i.test(l)) &&
      lines.some((l) => /^(bar|line)\s+\[/.test(l)),
  },
  {
    kind: 'gitGraph',
    canonical: 'gitGraph',
    test: (lines) =>
      lines.some((l) => /^(commit|branch|checkout|merge)\b/i.test(l)),
  },
  {
    kind: 'mindmap',
    canonical: 'mindmap',
    test: (lines) => {
      const indented = lines.filter((l) => /^\s{2,}/.test(l));
      return indented.length >= 2 && lines.length <= 30;
    },
  },
  {
    kind: 'journey',
    canonical: 'journey',
    test: (lines) =>
      lines.some((l) => /^section\s+/i.test(l)) &&
      lines.some((l) => /:\s*\d+\s*:\s*\w+/.test(l)),
  },
  {
    kind: 'timeline',
    canonical: 'timeline',
    test: (lines) =>
      lines.some((l) => /^section\s+/i.test(l)) &&
      lines.some((l) => /^\s+\d{4}\b/.test(l)),
  },
  {
    kind: 'venn-beta',
    canonical: 'venn-beta',
    test: (lines) =>
      lines.some((l) => /^set\s+\w+/i.test(l)) ||
      lines.some((l) => /^union\s+\w+/i.test(l)),
  },
  {
    kind: 'sankey-beta',
    canonical: 'sankey-beta',
    test: (lines) => lines.some((l) => /^[^,]+,[^,]+,[\d.]+$/.test(l.trim())),
  },
];

export function detectIntent(code: string): DetectionResult | null {
  const lines = stripPreamble(code);
  if (!lines.length) return null;

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase().trim();

    for (const { lower, canonical } of SORTED_CANDIDATES) {
      if (
        lineLower === lower ||
        lineLower.startsWith(lower + ' ') ||
        lineLower.startsWith(lower + '\t') ||
        lineLower.startsWith(lower + '(') ||
        lineLower.startsWith(lower + '{') ||
        lineLower.startsWith(lower + '[')
      ) {
        const isCanonical = lineLower.startsWith(canonical.toLowerCase());
        return {
          kind: canonical as DiagramKind,
          canonical,
          confidence: isCanonical ? 'high' : 'medium',
          matchedAlias: isCanonical
            ? undefined
            : line.trim().split(/[\s({[]/)[0],
          firstLine: line,
          lineIndex: i,
        };
      }
    }
  }

  for (const h of STRUCTURAL_HEURISTICS) {
    if (h.test(lines)) {
      return {
        kind: h.kind,
        canonical: h.canonical,
        confidence: 'low',
        firstLine: lines[0],
        lineIndex: 0,
      };
    }
  }

  return null;
}

function stripPreamble(code: string): string[] {
  const raw = code.split('\n');
  let start = 0;

  if (raw[0]?.trim() === '---') {
    const end = raw.findIndex((l, i) => i > 0 && l.trim() === '---');
    start = end !== -1 ? end + 1 : 0;
  }

  return raw.slice(start).filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('%%');
  });
}

export function isXYAlias(detection: DetectionResult): boolean {
  if (detection.canonical !== 'xychart-beta') return false;

  return detection.confidence === 'medium' && !!detection.matchedAlias;
}
