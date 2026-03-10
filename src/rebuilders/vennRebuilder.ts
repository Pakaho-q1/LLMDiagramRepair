import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

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

export function parseLooseVenn(code: string): VennModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const isVenn = /^(venn(-beta)?|venn\s*diagram|overlap|set[-_]?diagram)/i.test(
    lines[0].toLowerCase(),
  );
  if (!isVenn) return null;

  const model: VennModel = { sets: [], unions: [] };
  let currentContext: VennSet | VennUnion | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
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
    const unionMatch = line.match(
      /^(?:union|intersection|overlap)\s+([\w\s]+?)(?:\s*\["([^"]+)"\])?(?:\s*:\s*([\d.]+))?$/i,
    );
    if (unionMatch) {
      currentContext = {
        ids: unionMatch[1].trim().split(/\s+/),
        label: unionMatch[2],
        size: unionMatch[3] ? Number(unionMatch[3]) : undefined,
        texts: [],
      };
      model.unions.push(currentContext as VennUnion);
      continue;
    }
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
    const textMatch = line.match(
      /^text\s+(?:\["([^"]+)"\]|["'](.+?)["']|(.+))$/i,
    );
    if (textMatch && currentContext) {
      currentContext.texts.push(
        (textMatch[1] ?? textMatch[2] ?? textMatch[3]).trim(),
      );
      continue;
    }
    if (/^style\s+/i.test(line) && currentContext) {
      currentContext.style = line;
      continue;
    }
    if (currentContext && !/^(set|union|circle|text|style)\s/i.test(line))
      currentContext.texts.push(line.replace(/^["']|["']$/g, "").trim());
  }

  if (!model.sets.length) return null;
  return model;
}

export function buildVenn(model: VennModel): string {
  const lines: string[] = ["venn-beta"];
  for (const s of model.sets) {
    let line = `  set ${s.id}`;
    if (s.label) line += `["${s.label.replace(/"/g, '\\"')}"]`;
    if (s.size !== undefined) line += `:${s.size}`;
    lines.push(line);
    for (const t of s.texts) lines.push(`    text "${t.replace(/"/g, '\\"')}"`);
    if (s.style) lines.push(`  ${s.style}`);
  }
  for (const u of model.unions) {
    let line = `  union ${u.ids.join(" ")}`;
    if (u.label) line += `["${u.label.replace(/"/g, '\\"')}"]`;
    if (u.size !== undefined) line += `:${u.size}`;
    lines.push(line);
    for (const t of u.texts) lines.push(`    text "${t.replace(/"/g, '\\"')}"`);
    if (u.style) lines.push(`  ${u.style}`);
  }
  return lines.join("\n");
}

export const vennRebuilderPass = {
  name: "venn-rebuilder",
  appliesTo: ["venn-beta"] as DiagramKind[],
  isRebuilder: true,
  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const model = parseLooseVenn(code);
    if (!model)
      return { passName: this.name, changed: false, code, repairs: [] };
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
