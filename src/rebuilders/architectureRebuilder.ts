// rebuilders/architectureRebuilder.ts
import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface ArchService {
  id: string;
  in?: string;
  icon?: string;
  label: string;
}
interface ArchGroup {
  id: string;
  in?: string;
  icon?: string;
  label: string;
}
interface ArchEdge {
  lhs: string;
  lhsDir: string;
  rhsDir: string;
  rhs: string;
  label?: string;
}
interface ArchModel {
  services: ArchService[];
  groups: ArchGroup[];
  edges: ArchEdge[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

const VALID_DIRS = new Set(["L", "R", "T", "B"]);

function parseIconLabel(raw: string): { icon?: string; label: string } {
  const m = raw.match(
    /^(\w+)\s*(?:\(["']?([^)"']+)["']?\))?\s*(?:\[["']?([^"'\]]+)["']?\])?$/,
  );
  if (!m) return { label: stripQuotes(raw) };
  return { icon: m[2], label: m[3] ?? m[1] };
}

export function parseLooseArchitecture(code: string): ArchModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isArch =
    /^(architecture(-beta)?|Architecture|arch\b|archDiagram|systemArchitecture|infraDiagram|deploymentDiagram|cloudArchitecture|microserviceDiagram|awsDiagram|gcpDiagram|azureDiagram)/i.test(
      lines[0],
    );
  if (!isArch) return null;

  const model: ArchModel = { services: [], groups: [], edges: [] };
  let currentGroup: string | undefined;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%") || line === "}") {
      if (line === "}") currentGroup = undefined;
      continue;
    }

    const groupMatch = line.match(/^group\s+(.+?)\s*\{?\s*$/i);
    if (groupMatch) {
      const { icon, label } = parseIconLabel(groupMatch[1]);
      const idMatch = groupMatch[1].match(/^(\w+)/);
      const id = idMatch?.[1] ?? `g${model.groups.length}`;
      model.groups.push({ id, icon, label, in: currentGroup });
      if (line.endsWith("{")) currentGroup = id;
      continue;
    }

    const serviceMatch = line.match(/^service\s+(.+?)(?:\s+in\s+(\w+))?\s*$/i);
    if (serviceMatch) {
      const { icon, label } = parseIconLabel(serviceMatch[1]);
      const idMatch = serviceMatch[1].match(/^(\w+)/);
      const id = idMatch?.[1] ?? `s${model.services.length}`;
      model.services.push({
        id,
        icon,
        label,
        in: serviceMatch[2] ?? currentGroup,
      });
      continue;
    }

    const edgeFull = line.match(
      /^(\w+)\{([LRTB])\}\s*(?:--\s*"?([^"]*)"?\s*)?-->\s*(\w+)\{([LRTB])\}/,
    );
    if (edgeFull) {
      model.edges.push({
        lhs: edgeFull[1],
        lhsDir: edgeFull[2],
        rhsDir: edgeFull[5],
        rhs: edgeFull[4],
        label: edgeFull[3]?.trim(),
      });
      continue;
    }

    const looseEdge = line.match(
      /^(\w+)\s*(?:-->|->|--)\s*(\w+)(?:\s*:\s*(.+))?$/,
    );
    if (looseEdge) {
      model.edges.push({
        lhs: looseEdge[1],
        lhsDir: "R",
        rhsDir: "L",
        rhs: looseEdge[2],
        label: looseEdge[3]?.trim(),
      });
      continue;
    }

    const bareId = line.match(/^(\w+)\["([^"]+)"\]$/);
    if (bareId) {
      model.services.push({
        id: bareId[1],
        label: bareId[2],
        in: currentGroup,
      });
    }
  }

  if (!model.services.length && !model.groups.length) return null;
  return model;
}

export function buildArchitecture(model: ArchModel): string {
  const lines = ["architecture-beta"];

  for (const g of model.groups) {
    const iconStr = g.icon ? `(${g.icon})` : "";
    const inStr = g.in ? ` in ${g.in}` : "";
    lines.push(`  group ${g.id}${iconStr}["${g.label}"]${inStr}`);
  }

  for (const s of model.services) {
    const iconStr = s.icon ? `(${s.icon})` : "(server)";
    const inStr = s.in ? ` in ${s.in}` : "";
    lines.push(`  service ${s.id}${iconStr}["${s.label}"]${inStr}`);
  }

  for (const e of model.edges) {
    const labelStr = e.label ? ` "${e.label}"` : "";
    lines.push(
      `  ${e.lhs}{${e.lhsDir}} --${labelStr}--> ${e.rhs}{${e.rhsDir}}`,
    );
  }

  return lines.join("\n");
}

export const architectureRebuilderPass = {
  name: "architecture-rebuilder",
  isRebuilder: true,
  appliesTo: ["architecture-beta"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseArchitecture(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildArchitecture(model);
    const changed = rebuilt !== ctx.code;
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt architecture-beta (${model.services.length} services, ${model.edges.length} connections)`,
          ]
        : [],
    };
  },
};
