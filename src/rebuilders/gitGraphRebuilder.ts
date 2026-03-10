import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

type GitOp =
  | { op: "commit"; msg?: string; id?: string; tag?: string; type?: string }
  | { op: "branch"; name: string }
  | { op: "checkout"; name: string }
  | { op: "merge"; name: string; id?: string; tag?: string; type?: string }
  | { op: "cherry-pick"; id: string };

interface GitModel {
  direction?: string;
  ops: GitOp[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

export function parseLooseGitGraph(code: string): GitModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isGit =
    /^(gitGraph|gitgraph|git[-_]graph|GitGraph|Git Graph|gitflow|git\s*LR|git\s*TB)/i.test(
      lines[0],
    );
  if (!isGit) return null;

  const model: GitModel = { ops: [] };

  const dirMatch = lines[0].match(/\b(LR|TB)\b/i);
  if (dirMatch) model.direction = dirMatch[1].toUpperCase();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%")) continue;

    if (/^commit\b/i.test(line)) {
      const op: Extract<GitOp, { op: "commit" }> = { op: "commit" };
      const idMatch = line.match(/\bid:\s*["']?([^"',\s]+)["']?/i);
      const msgMatch =
        line.match(/\bmsg:\s*["']([^"']+)["']/i) ??
        line.match(/\bmessage:\s*["']([^"']+)["']/i);
      const tagMatch = line.match(/\btag:\s*["']?([^"',\s]+)["']?/i);
      const typeMatch = line.match(/\btype:\s*(\w+)/i);
      if (idMatch) op.id = stripQuotes(idMatch[1]);
      if (msgMatch) op.msg = stripQuotes(msgMatch[1]);
      if (tagMatch) op.tag = stripQuotes(tagMatch[1]);
      if (typeMatch) op.type = typeMatch[1].toUpperCase();
      model.ops.push(op);
      continue;
    }

    const branchMatch = line.match(
      /^branch\s+["']?(.+?)["']?(?:\s+order:\s*\d+)?$/i,
    );
    if (branchMatch) {
      model.ops.push({ op: "branch", name: stripQuotes(branchMatch[1]) });
      continue;
    }

    const checkoutMatch = line.match(
      /^(?:checkout|switch)\s+["']?(.+?)["']?$/i,
    );
    if (checkoutMatch) {
      model.ops.push({ op: "checkout", name: stripQuotes(checkoutMatch[1]) });
      continue;
    }

    const mergeMatch = line.match(/^merge\s+["']?(\S+?)["']?/i);
    if (mergeMatch) {
      const op: Extract<GitOp, { op: "merge" }> = {
        op: "merge",
        name: stripQuotes(mergeMatch[1]),
      };
      const idM = line.match(/\bid:\s*["']?([^"',\s]+)["']?/i);
      const tagM = line.match(/\btag:\s*["']?([^"',\s]+)["']?/i);
      const typeM = line.match(/\btype:\s*(\w+)/i);
      if (idM) op.id = stripQuotes(idM[1]);
      if (tagM) op.tag = stripQuotes(tagM[1]);
      if (typeM) op.type = typeM[1].toUpperCase();
      model.ops.push(op);
      continue;
    }

    const cpMatch = line.match(/^cherry-pick\s+(?:id:\s*)?["']?(\S+?)["']?$/i);
    if (cpMatch) {
      model.ops.push({ op: "cherry-pick", id: stripQuotes(cpMatch[1]) });
      continue;
    }
  }

  if (!model.ops.length) return null;
  return model;
}

export function buildGitGraph(model: GitModel): string {
  const header = model.direction ? `gitGraph ${model.direction}:` : "gitGraph";
  const lines = [header];

  for (const op of model.ops) {
    switch (op.op) {
      case "commit": {
        const parts: string[] = ["  commit"];
        if (op.id) parts.push(`id: "${op.id}"`);
        if (op.msg) parts.push(`msg: "${op.msg}"`);
        if (op.tag) parts.push(`tag: "${op.tag}"`);
        if (op.type) parts.push(`type: ${op.type}`);
        lines.push(parts.join(" "));
        break;
      }
      case "branch":
        lines.push(`  branch ${op.name}`);
        break;
      case "checkout":
        lines.push(`  checkout ${op.name}`);
        break;
      case "merge": {
        const parts = [`  merge ${op.name}`];
        if (op.id) parts.push(`id: "${op.id}"`);
        if (op.tag) parts.push(`tag: "${op.tag}"`);
        if (op.type) parts.push(`type: ${op.type}`);
        lines.push(parts.join(" "));
        break;
      }
      case "cherry-pick":
        lines.push(`  cherry-pick id: "${op.id}"`);
        break;
    }
  }

  return lines.join("\n");
}

export const gitGraphRebuilderPass = {
  name: "gitgraph-rebuilder",
  isRebuilder: true,
  appliesTo: ["gitGraph"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseGitGraph(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildGitGraph(model);
    const changed = rebuilt !== ctx.code;
    const commits = model.ops.filter((o) => o.op === "commit").length;
    const branches = model.ops.filter((o) => o.op === "branch").length;
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [`Rebuilt gitGraph (${commits} commits, ${branches} branches)`]
        : [],
    };
  },
};
