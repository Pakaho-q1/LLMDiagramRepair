import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface Requirement {
  type: string;
  id: string;
  name: string;
  text?: string;
  risk?: string;
  verifyMethod?: string;
}
interface ReqElement {
  id: string;
  name: string;
  type?: string;
  docref?: string;
}
interface ReqRelationship {
  type: string;
  from: string;
  to: string;
}
interface RequirementModel {
  requirements: Requirement[];
  elements: ReqElement[];
  relationships: ReqRelationship[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

const REQ_TYPES = new Set([
  "requirement",
  "functionalRequirement",
  "interfaceRequirement",
  "performanceRequirement",
  "physicalRequirement",
  "designConstraint",
]);
const REL_TYPES = new Set([
  "contains",
  "copies",
  "derives",
  "satisfies",
  "verifies",
  "refines",
  "traces",
]);

export function parseLooseRequirement(code: string): RequirementModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isReq =
    /^(requirementDiagram|requirement|requirements|req\b|requirementdiagram)/i.test(
      lines[0],
    );
  if (!isReq) return null;

  const model: RequirementModel = {
    requirements: [],
    elements: [],
    relationships: [],
  };
  let current: Requirement | ReqElement | null = null;
  let currentType: "req" | "element" | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%")) continue;
    if (line === "}") {
      current = null;
      currentType = null;
      continue;
    }

    const reqBlockMatch = line.match(/^(\w+)\s+(\w+)\s*\{?$/);
    if (reqBlockMatch && REQ_TYPES.has(reqBlockMatch[1])) {
      current = {
        type: reqBlockMatch[1],
        id: reqBlockMatch[2],
        name: reqBlockMatch[2],
      };
      currentType = "req";
      model.requirements.push(current as Requirement);
      continue;
    }

    const elemMatch = line.match(/^element\s+(\w+)\s*\{?$/i);
    if (elemMatch) {
      current = { id: elemMatch[1], name: elemMatch[1] };
      currentType = "element";
      model.elements.push(current as ReqElement);
      continue;
    }

    if (current && currentType === "req") {
      const req = current as Requirement;
      if (/^id\s*:/i.test(line)) {
        req.id = stripQuotes(line.replace(/^id\s*:\s*/i, ""));
        continue;
      }
      if (/^text\s*:/i.test(line)) {
        req.text = stripQuotes(line.replace(/^text\s*:\s*/i, ""));
        continue;
      }
      if (/^risk\s*:/i.test(line)) {
        req.risk = stripQuotes(line.replace(/^risk\s*:\s*/i, ""));
        continue;
      }
      if (/^verifyMethod\s*:/i.test(line)) {
        req.verifyMethod = stripQuotes(
          line.replace(/^verifyMethod\s*:\s*/i, ""),
        );
        continue;
      }
    }

    if (current && currentType === "element") {
      const el = current as ReqElement;
      if (/^type\s*:/i.test(line)) {
        el.type = stripQuotes(line.replace(/^type\s*:\s*/i, ""));
        continue;
      }
      if (/^docref\s*:/i.test(line)) {
        el.docref = stripQuotes(line.replace(/^docref\s*:\s*/i, ""));
        continue;
      }
    }

    const relArrow = line.match(/^(\w+)\s*-\s*(\w+)\s*->\s*(\w+)$/);
    if (relArrow && REL_TYPES.has(relArrow[2])) {
      model.relationships.push({
        type: relArrow[2],
        from: relArrow[1],
        to: relArrow[3],
      });
      continue;
    }

    const relVerb = line.match(
      /^(\w+)\s+(contains|copies|derives|satisfies|verifies|refines|traces)\s+(\w+)$/i,
    );
    if (relVerb) {
      model.relationships.push({
        type: relVerb[2].toLowerCase(),
        from: relVerb[1],
        to: relVerb[3],
      });
    }
  }

  if (!model.requirements.length && !model.elements.length) return null;
  return model;
}

export function buildRequirement(model: RequirementModel): string {
  const lines = ["requirementDiagram"];

  for (const req of model.requirements) {
    lines.push(`  ${req.type} ${req.id} {`);
    lines.push(`    id: "${req.id}"`);
    if (req.text) lines.push(`    text: "${req.text}"`);
    if (req.risk) lines.push(`    risk: ${req.risk}`);
    if (req.verifyMethod) lines.push(`    verifyMethod: ${req.verifyMethod}`);
    lines.push(`  }`);
  }

  for (const el of model.elements) {
    lines.push(`  element ${el.name} {`);
    if (el.type) lines.push(`    type: ${el.type}`);
    if (el.docref) lines.push(`    docref: ${el.docref}`);
    lines.push(`  }`);
  }

  for (const rel of model.relationships) {
    lines.push(`  ${rel.from} - ${rel.type} -> ${rel.to}`);
  }

  return lines.join("\n");
}

export const requirementRebuilderPass = {
  name: "requirement-rebuilder",
  isRebuilder: true,
  appliesTo: ["requirementDiagram"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseRequirement(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildRequirement(model);
    const changed = rebuilt !== ctx.code;
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt requirementDiagram (${model.requirements.length} requirements, ${model.relationships.length} relationships)`,
          ]
        : [],
    };
  },
};
