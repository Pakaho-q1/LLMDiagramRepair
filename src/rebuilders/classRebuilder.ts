// ============================================================
// rebuilders/classRebuilder.ts
// Deterministic Rebuild สำหรับ Class Diagram
// รองรับ loose format ที่ LLM มักสร้าง
// ============================================================

import type { RepairContext, RepairResult } from '../types/index.js';

// ─────────────────────────────────────────────
// Data Model
// ─────────────────────────────────────────────

type Visibility = '+' | '-' | '#' | '~' | '';
type ClassifierType = 'abstract' | 'interface' | 'enum' | 'class';

interface ClassMember {
  visibility: Visibility;
  name: string;
  type?: string;       // return type / field type
  isMethod: boolean;
  params?: string;     // method params string
  isStatic?: boolean;
  isAbstract?: boolean;
}

interface ClassDef {
  name: string;
  annotation?: string;       // <<interface>>, <<abstract>>, <<enum>> etc.
  classifier?: ClassifierType;
  members: ClassMember[];
  generics?: string;         // e.g. T, K extends V
}

type RelationshipType =
  | '<|--'   // Inheritance
  | '--|>'   // Inheritance (reversed)
  | '*--'    // Composition
  | '--*'    // Composition (reversed)
  | 'o--'    // Aggregation
  | '--o'    // Aggregation (reversed)
  | '-->'    // Association
  | '<--'    // Association (reversed)
  | '<-->'   // Bidirectional
  | '..|>'   // Realization
  | '<|..'   // Realization (reversed)
  | '--'     // Link (solid)
  | '..';    // Link (dashed)

interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  fromCardinality?: string;
  toCardinality?: string;
  label?: string;
}

interface ClassDiagramModel {
  title?: string;
  classes: Map<string, ClassDef>;
  relationships: Relationship[];
  notes: Array<{ text: string; target?: string }>;
}

// ─────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────

export function parseLooseClassDiagram(code: string): ClassDiagramModel | null {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  if (!lines.length) return null;

  const headerLine = lines[0].toLowerCase();
  const isClass =
    /^(classdiagram|class[-_]?diagram|class\b|uml[-_]?class|classDiagram-v2)/i.test(
      headerLine,
    );
  if (!isClass) return null;

  const model: ClassDiagramModel = {
    classes: new Map(),
    relationships: [],
    notes: [],
  };

  let i = 1;
  let currentClass: ClassDef | null = null;
  let inClassBlock = false;

  while (i < lines.length) {
    const line = lines[i];

    // ── title ────────────────────────────────────
    const titleMatch = line.match(/^title[:\s]+(.+)$/i);
    if (titleMatch) {
      model.title = titleMatch[1].trim();
      i++;
      continue;
    }

    // ── class block open: class Foo { ────────────
    const classBlockOpen = line.match(/^class\s+(\w+)(?:<([^>]+)>)?\s*(?:\{|$)/i);
    if (classBlockOpen) {
      const name = classBlockOpen[1];
      const generics = classBlockOpen[2];
      currentClass = getOrCreateClass(model, name);
      if (generics) currentClass.generics = generics;
      inClassBlock = line.endsWith('{');
      i++;
      continue;
    }

    // ── closing brace → end of class block ───────
    if (line === '}' && inClassBlock) {
      currentClass = null;
      inClassBlock = false;
      i++;
      continue;
    }

    // ── annotation: <<interface>>, <<abstract>> ───
    const annotationMatch = line.match(/^<<\s*([^>]+)\s*>>\s*(\w+)?$/i);
    if (annotationMatch) {
      const annotation = annotationMatch[1].trim();
      const targetName = annotationMatch[2];
      if (targetName) {
        const cls = getOrCreateClass(model, targetName);
        cls.annotation = annotation;
      } else if (currentClass) {
        currentClass.annotation = annotation;
      }
      i++;
      continue;
    }

    // ── namespace / note (skip gracefully) ───────
    if (/^note\s+/i.test(line)) {
      const noteMatch = line.match(/^note\s+(?:for\s+(\w+)\s+)?"?([^"]+)"?/i);
      if (noteMatch) {
        model.notes.push({ text: noteMatch[2], target: noteMatch[1] });
      }
      i++;
      continue;
    }

    // ── relationship line ─────────────────────────
    // Patterns: A <|-- B, A --|> B, A "1" --> "N" B : label
    const relResult = parseRelationshipLine(line);
    if (relResult) {
      model.relationships.push(relResult);
      // auto-register classes ที่ปรากฏใน relationship
      getOrCreateClass(model, relResult.from);
      getOrCreateClass(model, relResult.to);
      i++;
      continue;
    }

    // ── class member (inside block หรือ standalone) ──
    // Patterns:
    //   +String name          (field)
    //   +getName() String     (method)
    //   ClassName : +field    (standalone member)
    const standaloneMember = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (standaloneMember && !inClassBlock) {
      const className = standaloneMember[1];
      const memberStr = standaloneMember[2].trim();

      // ป้องกัน false-positive กับ relationship syntax
      if (!/(<\|-|-\|>|\*--|--\*|o--|--o|-->|<--|\.\.|\|\|)/.test(memberStr)) {
        const cls = getOrCreateClass(model, className);
        const member = parseMember(memberStr);
        if (member) cls.members.push(member);
      }
      i++;
      continue;
    }

    // ── member inside class block ─────────────────
    if (inClassBlock && currentClass && line !== '{') {
      // annotation inside block: <<interface>>
      const innerAnnotation = line.match(/^<<\s*([^>]+)\s*>>$/);
      if (innerAnnotation) {
        currentClass.annotation = innerAnnotation[1].trim();
        i++;
        continue;
      }

      const member = parseMember(line);
      if (member) currentClass.members.push(member);
      i++;
      continue;
    }

    i++;
  }

  // ต้องมี class หรือ relationship อย่างน้อย 1 อย่าง
  if (model.classes.size === 0 && model.relationships.length === 0) return null;

  return model;
}

// ─────────────────────────────────────────────
// Relationship Line Parser
// ─────────────────────────────────────────────

function parseRelationshipLine(line: string): Relationship | null {
  // Pattern: ClassA [cardinality] RelType [cardinality] ClassB [: label]
  // รองรับ: <|--, --|>, *--, --*, o--, --o, -->, <--, ..|>, <|.., --, ..
  const REL_PATTERN =
    /^(\w+)\s*(?:"([^"]+)")?\s*(<\|--|--\|>|\*--|--\*|o--|--o|<-->|-->|<--|\.\.>\||\<\|\.\.|\.\.|\|\|--)\s*(?:"([^"]+)")?\s*(\w+)(?:\s*:\s*(.+))?$/;

  // ลอง pattern หลักก่อน
  let m = line.match(REL_PATTERN);
  if (m) {
    return {
      from: m[1],
      fromCardinality: m[2],
      type: normalizeRelType(m[3]) as RelationshipType,
      toCardinality: m[4],
      to: m[5],
      label: m[6]?.trim(),
    };
  }

  // fallback: looser pattern สำหรับ LLM ที่ใช้ space แปลก ๆ
  // e.g. "Animal <-- Dog" หรือ "A -- B : uses"
  const LOOSE_REL =
    /^(\w+)\s+(<\|--|--\|>|\*--|--\*|o--|--o|-->|<--|\.\.\.>|<\|\.\.|\.\.\|>|--|\.\.)\s+(\w+)(?:\s*:\s*(.+))?$/;
  m = line.match(LOOSE_REL);
  if (m) {
    return {
      from: m[1],
      type: normalizeRelType(m[2]) as RelationshipType,
      to: m[3],
      label: m[4]?.trim(),
    };
  }

  return null;
}

function normalizeRelType(raw: string): RelationshipType {
  const map: Record<string, RelationshipType> = {
    '<|--': '<|--',
    '--|>': '--|>',
    '*--': '*--',
    '--*': '--*',
    'o--': 'o--',
    '--o': '--o',
    '-->': '-->',
    '<--': '<--',
    '<-->': '<-->',
    '..|>': '..|>',
    '<|..': '<|..',
    '...>': '-->',    // LLM hallucination → normalize
    '<--': '<--',
    '--': '--',
    '..': '..',
  };
  return map[raw] ?? '--';
}

// ─────────────────────────────────────────────
// Member Parser
// ─────────────────────────────────────────────

function parseMember(raw: string): ClassMember | null {
  const s = raw.trim();
  if (!s || s === '{' || s === '}') return null;

  // ── Visibility prefix ─────────────────────
  let visibility: Visibility = '';
  let rest = s;
  if (/^[+\-#~]/.test(s)) {
    visibility = s[0] as Visibility;
    rest = s.slice(1).trim();
  }

  // ── Static: $prefix หรือ $ suffix ─────────
  let isStatic = false;
  if (rest.startsWith('$')) {
    isStatic = true;
    rest = rest.slice(1).trim();
  }

  // ── Abstract: *prefix ─────────────────────
  let isAbstract = false;
  if (rest.startsWith('*')) {
    isAbstract = true;
    rest = rest.slice(1).trim();
  }

  // ── Method: name(params) ReturnType ───────
  const methodMatch = rest.match(/^([\w_]+)\s*\(([^)]*)\)\s*(?::\s*(.+))?$/);
  if (methodMatch) {
    return {
      visibility,
      name: methodMatch[1],
      params: methodMatch[2].trim(),
      type: methodMatch[3]?.trim(),
      isMethod: true,
      isStatic,
      isAbstract,
    };
  }

  // ── Field: Type name หรือ name Type ──────
  // LLM มักสร้างทั้งสองแบบ
  const fieldMatch = rest.match(/^([\w_<>\[\]]+)\s+([\w_]+)$/) ||
    rest.match(/^([\w_]+)\s*:\s*([\w_<>\[\]]+)$/);
  if (fieldMatch) {
    return {
      visibility,
      name: fieldMatch[1],
      type: fieldMatch[2],
      isMethod: false,
      isStatic,
      isAbstract,
    };
  }

  // ── Bare name (no type) ───────────────────
  const bareMatch = rest.match(/^([\w_]+)$/);
  if (bareMatch) {
    return {
      visibility,
      name: bareMatch[1],
      isMethod: false,
      isStatic,
      isAbstract,
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────

export function buildClassDiagram(model: ClassDiagramModel): string {
  const lines: string[] = ['classDiagram'];

  if (model.title) {
    lines.push(`  title ${model.title}`);
  }

  // ── Class definitions ──────────────────────
  for (const [, cls] of model.classes) {
    const genericStr = cls.generics ? `~${cls.generics}~` : '';
    lines.push(`  class ${cls.name}${genericStr} {`);

    if (cls.annotation) {
      lines.push(`    <<${cls.annotation}>>`);
    }

    for (const member of cls.members) {
      lines.push(`    ${formatMember(member)}`);
    }

    lines.push(`  }`);
  }

  // ── Relationships ──────────────────────────
  for (const rel of model.relationships) {
    const fromCard = rel.fromCardinality ? ` "${rel.fromCardinality}"` : '';
    const toCard = rel.toCardinality ? ` "${rel.toCardinality}"` : '';
    const label = rel.label ? ` : ${rel.label}` : '';
    lines.push(`  ${rel.from}${fromCard} ${rel.type}${toCard} ${rel.to}${label}`);
  }

  // ── Notes ──────────────────────────────────
  for (const note of model.notes) {
    if (note.target) {
      lines.push(`  note for ${note.target} "${escapeQuotes(note.text)}"`);
    } else {
      lines.push(`  note "${escapeQuotes(note.text)}"`);
    }
  }

  return lines.join('\n');
}

function formatMember(m: ClassMember): string {
  const vis = m.visibility ?? '';
  const stat = m.isStatic ? '$' : '';
  const abs = m.isAbstract ? '*' : '';

  if (m.isMethod) {
    const params = m.params ?? '';
    const ret = m.type ? ` ${m.type}` : '';
    return `${vis}${stat}${abs}${m.name}(${params})${ret}`;
  }

  const typeStr = m.type ? ` ${m.type}` : '';
  return `${vis}${stat}${abs}${m.name}${typeStr}`;
}

// ─────────────────────────────────────────────
// Repair Pass
// ─────────────────────────────────────────────

export const classRebuilderPass = {
  name: 'class-rebuilder',
  appliesTo: ['classDiagram'] as DiagramKind[],
  isRebuilder: true,

  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const model = parseLooseClassDiagram(code);

    if (!model) {
      return { passName: this.name, changed: false, code, repairs: [] };
    }

    const rebuilt = buildClassDiagram(model);
    const changed = rebuilt !== code;

    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt classDiagram (${model.classes.size} classes, ${model.relationships.length} relationships)`,
          ]
        : [],
    };
  },
};

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function getOrCreateClass(model: ClassDiagramModel, name: string): ClassDef {
  if (!model.classes.has(name)) {
    model.classes.set(name, { name, members: [] });
  }
  return model.classes.get(name)!;
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}
