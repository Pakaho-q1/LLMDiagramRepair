import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

type Cardinality = "||" | "|{" | "}{" | "|o" | "o|" | "o{" | "}o" | "||";
interface ERAttribute {
  type: string;
  name: string;
  isPK?: boolean;
  isFK?: boolean;
  comment?: string;
}
interface EREntity {
  name: string;
  attributes: ERAttribute[];
}
interface ERRelationship {
  from: string;
  to: string;
  fromCard: string;
  toCard: string;
  relType: "identifying" | "non-identifying";
  label: string;
}
interface ERModel {
  entities: Map<string, EREntity>;
  relationships: ERRelationship[];
}

const CARD_MAP: Record<string, string> = {
  one: "||",
  "1": "||",
  "only one": "||",
  "zero or one": "|o",
  "0..1": "|o",
  "zero or more": "}o",
  many: "}|",
  "*": "}|",
  "one or more": "}|",
  "1..*": "}|",
  "+": "}|",
};

function normalizeCard(s: string): string {
  const k = s.trim().toLowerCase();
  return CARD_MAP[k] ?? s;
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

export function parseLooseER(code: string): ERModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isER =
    /^(erDiagram|er\b|erdDiagram|er[-_]diagram|ERDiagram|ER Diagram|entity|entityRelationship|dbDiagram|databaseDiagram|dataModel)/i.test(
      lines[0],
    );
  if (!isER) return null;

  const model: ERModel = { entities: new Map(), relationships: [] };
  let currentEntity: EREntity | null = null;
  let inBlock = false;

  function getOrCreate(name: string): EREntity {
    if (!model.entities.has(name))
      model.entities.set(name, { name, attributes: [] });
    return model.entities.get(name)!;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%")) continue;

    if (line === "}") {
      currentEntity = null;
      inBlock = false;
      continue;
    }

    const blockOpen = line.match(/^(\w+)\s*\{/);
    if (blockOpen) {
      currentEntity = getOrCreate(blockOpen[1]);
      inBlock = true;
      continue;
    }

    if (inBlock && currentEntity) {
      const attrMatch = line.match(
        /^(\w+)\s+(\w+)(?:\s+(PK|FK|UK))?(?:\s+"([^"]+)")?/,
      );
      if (attrMatch) {
        currentEntity.attributes.push({
          type: attrMatch[1],
          name: attrMatch[2],
          isPK: attrMatch[3] === "PK",
          isFK: attrMatch[3] === "FK",
          comment: attrMatch[4],
        });
      }
      continue;
    }

    const relMatch = line.match(
      /^(\w+)\s+([|o{}*\-]+)\s*--\s*([|o{}*\-]+)\s+(\w+)\s*:\s*"?([^"]*)"?/,
    );
    if (relMatch) {
      getOrCreate(relMatch[1]);
      getOrCreate(relMatch[4]);
      model.relationships.push({
        from: relMatch[1],
        to: relMatch[4],
        fromCard: relMatch[2],
        toCard: relMatch[3],
        relType: relMatch[2].includes("--") ? "non-identifying" : "identifying",
        label: stripQuotes(relMatch[5]),
      });
      continue;
    }

    const verbMatch = line.match(
      /^(\w+)\s+(has|contains|references|belongs.?to|relates.?to)\s+(many|one|some)?\s*(\w+)/i,
    );
    if (verbMatch) {
      const from = verbMatch[1];
      const to = verbMatch[4];
      const isMany = /many|some/i.test(verbMatch[3] ?? "");
      getOrCreate(from);
      getOrCreate(to);
      model.relationships.push({
        from,
        to,
        fromCard: "||",
        toCard: isMany ? "}|" : "||",
        relType: "non-identifying",
        label: verbMatch[2],
      });
      continue;
    }

    const bareMatch = line.match(/^(\w+)$/);
    if (bareMatch) getOrCreate(bareMatch[1]);
  }

  if (!model.entities.size) return null;
  return model;
}

export function buildER(model: ERModel): string {
  const lines = ["erDiagram"];

  for (const rel of model.relationships) {
    const sep = rel.relType === "identifying" ? "--" : "--";
    lines.push(
      `  ${rel.from} ${rel.fromCard}--${rel.toCard} ${rel.to} : "${rel.label}"`,
    );
  }

  for (const entity of model.entities.values()) {
    if (!entity.attributes.length) continue;
    lines.push(`  ${entity.name} {`);
    for (const attr of entity.attributes) {
      let line = `    ${attr.type} ${attr.name}`;
      if (attr.isPK) line += " PK";
      else if (attr.isFK) line += " FK";
      if (attr.comment) line += ` "${attr.comment}"`;
      lines.push(line);
    }
    lines.push("  }");
  }

  return lines.join("\n");
}

export const erRebuilderPass = {
  name: "er-rebuilder",
  isRebuilder: true,
  appliesTo: ["erDiagram"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseER(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildER(model);
    const changed = rebuilt !== ctx.code;
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt erDiagram (${model.entities.size} entities, ${model.relationships.length} relationships)`,
          ]
        : [],
    };
  },
};
