import type {
  RepairContext,
  RepairResult,
  RepairPass,
} from "../types/index.js";

function makePass(
  name: string,
  appliesTo: string[] | undefined,
  fn: (code: string, ctx: RepairContext) => { code: string; repairs: string[] },
): RepairPass {
  return {
    name,
    appliesTo: appliesTo as any,
    repair(ctx: RepairContext): RepairResult {
      const { code, repairs } = fn(ctx.code, ctx);
      return {
        passName: name,
        changed: code !== ctx.code,
        code,
        repairs,
      };
    },
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isInsideBracketOrQuote(line: string, matchIndex: number): boolean {
  let inDoubleQuote = false;
  let bracketDepth = 0;

  for (let i = 0; i < matchIndex && i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inDoubleQuote) {
      inDoubleQuote = true;
    } else if (ch === '"' && inDoubleQuote) {
      inDoubleQuote = false;
    } else if (ch === "[" && !inDoubleQuote) {
      bracketDepth++;
    } else if (ch === "]" && !inDoubleQuote) {
      bracketDepth = Math.max(0, bracketDepth - 1);
    }
  }

  return inDoubleQuote || bracketDepth > 0;
}
export const keywordNormalizationPass: RepairPass = makePass(
  "keyword-normalization",
  undefined,
  (code, ctx) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!ctx.detection) return { code, repairs };

    const { canonical, matchedAlias } = ctx.detection;

    if (!matchedAlias) return { code, repairs };

    const firstLineMatch = fixed.match(/^[^\n]+/);
    if (!firstLineMatch) return { code, repairs };

    const firstLine = firstLineMatch[0];
    const aliasPattern = new RegExp(
      `^${escapeRegex(matchedAlias)}(\\s|$)`,
      "i",
    );

    if (aliasPattern.test(firstLine.trim())) {
      const rest = firstLine.trim().slice(matchedAlias.length);
      fixed = fixed.replace(firstLine, canonical + rest);
      repairs.push(`Normalized keyword: "${matchedAlias}" → "${canonical}"`);
    }

    return { code: fixed, repairs };
  },
);

export const flowchartRepairPass: RepairPass = makePass(
  "flowchart-repair",
  ["flowchart"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (/--{2,}>/.test(fixed)) {
      fixed = fixed
        .split("\n")
        .map((line) => {
          return line.replace(/--{2,}>/g, (match, offset) => {
            if (isInsideBracketOrQuote(line, offset)) return match;
            return "-->";
          });
        })
        .join("\n");
      repairs.push("Fixed over-extended arrows (---> → -->)");
    }

    const fixedLines = fixed.split("\n").map((line) => {
      if (/-->|---/.test(line)) return line;

      return line.replace(
        /(\b\w+\b)\s*--\s+(\b\w+\b)/g,
        (match, a, b, offset) => {
          if (isInsideBracketOrQuote(line, offset)) return match;
          repairs.push("Fixed missing > in arrow (-- → -->)");
          return `${a} --> ${b}`;
        },
      );
    });
    fixed = fixedLines.join("\n");

    if (/={3,}>/.test(fixed)) {
      fixed = fixed.replace(/={3,}>/g, "==>");
      repairs.push("Fixed over-extended thick arrows (===> → ==>)");
    }
    if (/\.-+>/.test(fixed)) {
      fixed = fixed.replace(/\.-+>/g, "-.->");
      repairs.push("Fixed dotted arrow format (.- → -.->)");
    }
    if (/^graph\s+(TD|TB|LR|RL|BT)/im.test(fixed)) {
      fixed = fixed.replace(/^graph\s+(TD|TB|LR|RL|BT)/im, "flowchart $1");
      repairs.push('Upgraded "graph" keyword → "flowchart"');
    }
    if (/^flowchart\s*\n/im.test(fixed)) {
      fixed = fixed.replace(/^flowchart\s*\n/im, "flowchart TD\n");
      repairs.push('Added missing direction "TD" to flowchart');
    }
    if (
      !/^(flowchart|graph)\s+/im.test(fixed) &&
      /\w+\s*(-->|---)/.test(fixed)
    ) {
      fixed = "flowchart TD\n" + fixed;
      repairs.push('Injected missing "flowchart TD" header');
    }

    fixed = fixed.replace(
      /(\w+)\[([^\]"]*'[^\]']*'[^\]]*)\]/g,
      (_, id, label) => `${id}["${label.replace(/'/g, "")}"]`,
    );

    const subgraphCount = (fixed.match(/^\s*subgraph\b/gim) ?? []).length;
    const endCount = (fixed.match(/^\s*end\b/gim) ?? []).length;
    if (subgraphCount > endCount) {
      const diff = subgraphCount - endCount;
      fixed = fixed + "\n" + Array(diff).fill("end").join("\n");
      repairs.push(`Added ${diff} missing "end" for subgraph`);
    }

    return { code: fixed, repairs };
  },
);

export const sequenceDiagramRepairPass: RepairPass = makePass(
  "sequence-repair",
  ["sequenceDiagram"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!fixed.toLowerCase().startsWith("sequencediagram")) {
      fixed = "sequenceDiagram\n" + fixed;
      repairs.push('Injected missing "sequenceDiagram" header');
    }
    if (/\w+\s*->\s*\w+\s*:/.test(fixed)) {
      fixed = fixed.replace(/(\w+)\s*->\s*(\w+\s*:)/g, "$1->>$2");
      repairs.push("Upgraded -> → ->> in sequence arrows");
    }
    if (/\w+\s*--->\s*\w+\s*:/.test(fixed)) {
      fixed = fixed.replace(/(\w+)\s*--->\s*(\w+\s*:)/g, "$1-->$2");
      repairs.push("Fixed ---> → --> in sequence");
    }
    const opens = ["alt", "loop", "opt", "par", "critical", "break"].reduce(
      (acc, kw) =>
        acc + (fixed.match(new RegExp(`^\\s*${kw}\\b`, "gim")) ?? []).length,
      0,
    );
    const closes = (fixed.match(/^\s*end\b/gim) ?? []).length;
    if (opens > closes) {
      fixed +=
        "\n" +
        Array(opens - closes)
          .fill("end")
          .join("\n");
      repairs.push(`Added ${opens - closes} missing "end" in sequence blocks`);
    }
    return { code: fixed, repairs };
  },
);

export const classDiagramRepairPass: RepairPass = makePass(
  "class-repair",
  ["classDiagram"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (/^classDiagram-v2\b/im.test(fixed)) {
      fixed = fixed.replace(/^classDiagram-v2\b/im, "classDiagram");
      repairs.push("Normalized classDiagram-v2 → classDiagram");
    }
    if (/\s+<--\s+/.test(fixed)) {
      fixed = fixed.replace(/\s+<--\s+/g, " <|-- ");
      repairs.push("Fixed inheritance arrow: <-- → <|--");
    }

    fixed = fixed.replace(
      /^(\s*)class\s+(\w+)\s+extends\s+(\w+)/gim,
      (_, indent, child, parent) => {
        repairs.push(
          `Converted "extends" → relationship: ${child} <|-- ${parent}`,
        );
        return `${indent}class ${child}\n${indent}${parent} <|-- ${child}`;
      },
    );

    fixed = fixed.replace(
      /^(\s*)class\s+(\w+)\s+implements\s+(\w+)/gim,
      (_, indent, child, iface) => {
        repairs.push(
          `Converted "implements" → relationship: ${child} ..|> ${iface}`,
        );
        return `${indent}class ${child}\n${indent}${iface} <|.. ${child}`;
      },
    );

    if (!fixed.toLowerCase().startsWith("classdiagram")) {
      fixed = "classDiagram\n" + fixed;
      repairs.push('Injected missing "classDiagram" header');
    }

    const opens = (fixed.match(/\{/g) ?? []).length;
    const closes = (fixed.match(/\}/g) ?? []).length;
    if (opens > closes) {
      fixed +=
        "\n" +
        Array(opens - closes)
          .fill("}")
          .join("\n");
      repairs.push(
        `Added ${opens - closes} missing closing "}" in classDiagram`,
      );
    }

    return { code: fixed, repairs };
  },
);

export const stateDiagramRepairPass: RepairPass = makePass(
  "state-repair",
  ["stateDiagram-v2"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (/^stateDiagram\b(?!-v2)/im.test(fixed)) {
      fixed = fixed.replace(/^stateDiagram\b(?!-v2)/im, "stateDiagram-v2");
      repairs.push("Upgraded stateDiagram → stateDiagram-v2");
    }

    return { code: fixed, repairs };
  },
);

export const gitGraphRepairPass: RepairPass = makePass(
  "gitgraph-repair",
  ["gitGraph"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (/^gitgraph\b(?! LR| TB)/im.test(fixed)) {
      fixed = fixed.replace(/^gitgraph\b/im, "gitGraph");
      repairs.push("Normalized gitgraph → gitGraph");
    }

    return { code: fixed, repairs };
  },
);

const BETA_DIAGRAMS = [
  "xychart",
  "sankey",
  "block",
  "packet",
  "architecture",
  "radar",
  "treemap",
  "venn",
] as const;

export const betaSuffixPass: RepairPass = makePass(
  "beta-suffix",
  undefined,
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    for (const kw of BETA_DIAGRAMS) {
      const pattern = new RegExp(`^${kw}\\b(?!-beta)`, "im");
      if (pattern.test(fixed)) {
        fixed = fixed.replace(pattern, `${kw}-beta`);
        repairs.push(`Added -beta suffix: ${kw} → ${kw}-beta`);
        break;
      }
    }

    return { code: fixed, repairs };
  },
);

export const erDiagramRepairPass: RepairPass = makePass(
  "er-repair",
  ["erDiagram"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!fixed.toLowerCase().startsWith("erdiagram")) {
      fixed = "erDiagram\n" + fixed;
      repairs.push('Injected missing "erDiagram" header');
    }

    return { code: fixed, repairs };
  },
);

export const ganttRepairPass: RepairPass = makePass(
  "gantt-repair",
  ["gantt"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!fixed.toLowerCase().startsWith("gantt")) {
      fixed = "gantt\n" + fixed;
      repairs.push('Injected missing "gantt" header');
    }

    if (!/^\s*dateFormat\s+/im.test(fixed)) {
      const sectionIdx = fixed.search(/^\s*section\s+/im);
      if (sectionIdx > 0) {
        const headerEnd = fixed.indexOf("\n") + 1;
        fixed =
          fixed.slice(0, headerEnd) +
          "  dateFormat YYYY-MM-DD\n" +
          fixed.slice(headerEnd);
        repairs.push("Injected default dateFormat YYYY-MM-DD");
      }
    }

    return { code: fixed, repairs };
  },
);

export const mindmapRepairPass: RepairPass = makePass(
  "mindmap-repair",
  ["mindmap"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!fixed.toLowerCase().startsWith("mindmap")) {
      fixed = "mindmap\n" + fixed;
      repairs.push('Injected missing "mindmap" header');
    }
    return { code: fixed, repairs };
  },
);

export const sankeyRepairPass: RepairPass = makePass(
  "sankey-repair",
  ["sankey-beta"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    const lines = fixed.split("\n");
    const repaired = lines.map((l) => {
      const t = l.trim();

      if (/^sankey/i.test(t) || t.startsWith("%%") || !t) return l;

      const arrowMatch = t.match(
        /^([^→\-,]+)\s*[→\-]+\s*([^:,]+)\s*[:\-,]\s*([\d.]+)/,
      );
      if (arrowMatch) {
        const repaired = `${arrowMatch[1].trim()},${arrowMatch[2].trim()},${arrowMatch[3].trim()}`;
        if (repaired !== t)
          repairs.push(`Fixed sankey row format: "${t}" → "${repaired}"`);
        return repaired;
      }
      return l;
    });

    fixed = repaired.join("\n");
    return { code: fixed, repairs };
  },
);

export const quadrantRepairPass: RepairPass = makePass(
  "quadrant-repair",
  ["quadrantChart"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!fixed.toLowerCase().startsWith("quadrantchart")) {
      fixed = "quadrantChart\n" + fixed;
      repairs.push('Injected missing "quadrantChart" header');
    }

    const lines = fixed.split("\n");
    const out: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trim();
      const itemBlockMatch = line.match(/^item\s+(\S+)\s*$/i);
      if (itemBlockMatch) {
        const label = itemBlockMatch[1];
        let xVal = "",
          yVal = "",
          labelVal = "";
        let j = i + 1;
        while (j < lines.length) {
          const sub = lines[j].trim();
          const xm = sub.match(/^x\s+([\d.]+)/i);
          const ym = sub.match(/^y\s+([\d.]+)/i);
          const lm = sub.match(/^label\s+"?([^"]+)"?/i);
          if (xm) {
            xVal = xm[1];
            j++;
            continue;
          }
          if (ym) {
            yVal = ym[1];
            j++;
            continue;
          }
          if (lm) {
            labelVal = lm[1];
            j++;
            continue;
          }
          break;
        }
        if (xVal && yVal) {
          const display = labelVal || label;
          out.push(`  ${display}: [${xVal}, ${yVal}]`);
          repairs.push(
            `Converted item block "${label}" → "${display}: [${xVal}, ${yVal}]"`,
          );
          i = j;
          continue;
        }
      }

      const pointMatch = line.match(/^(.+):\s*(\[[\d.,\s]+\])\s*$/);
      if (pointMatch && !/^(title|x-axis|y-axis|quadrant-\d|%%)/i.test(line)) {
        const origLabel = pointMatch[1].trim();
        const coords = pointMatch[2].trim();

        if (/\s/.test(origLabel)) {
          const isAsciiOnly = /^[\x00-\x7F]+$/.test(origLabel);
          let newLabel: string;
          if (isAsciiOnly) {
            newLabel = origLabel
              .split(/\s+/)
              .map((w, idx) =>
                idx === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1),
              )
              .join("");
          } else {
            newLabel = origLabel.replace(/\s+/g, "_");
          }
          const indent = raw.match(/^(\s*)/)?.[1] ?? "  ";
          out.push(`${indent}${newLabel}: ${coords}`);
          repairs.push(
            `Fixed space in point label: "${origLabel}" → "${newLabel}"`,
          );
          i++;
          continue;
        }
      }

      const qMatch = line.match(/^(quadrant-\d)\s+(.+)$/i);
      if (qMatch) {
        const qLabel = qMatch[2];
        const withoutParen = qLabel.replace(/\s*\([^)]*\)\s*$/, "").trim();
        const trimmed = withoutParen.slice(0, 60).trim();

        if (trimmed !== qLabel) {
          const indent = raw.match(/^(\s*)/)?.[1] ?? "  ";
          out.push(`${indent}${qMatch[1]} ${trimmed}`);
          repairs.push(`Cleaned quadrant label: "${qLabel.slice(0, 40)}…"`);
          i++;
          continue;
        }
      }
      out.push(raw);
      i++;
    }
    fixed = out.join("\n");
    return { code: fixed, repairs };
  },
);

export const timelineRepairPass: RepairPass = makePass(
  "timeline-repair",
  ["timeline"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!fixed.toLowerCase().startsWith("timeline")) {
      fixed = "timeline\n" + fixed;
      repairs.push('Injected missing "timeline" header');
    }

    const lines = fixed.split("\n");
    const out: string[] = [];
    let hasSection = lines.some((l) => /^\s*section\s+/i.test(l));

    if (!hasSection) {
      for (const line of lines) {
        const yearLine = line.match(/^(\s*)((\d{4})\s*[:\-–]\s*(.+))$/);
        if (yearLine) {
          const indent = yearLine[1];
          const year = yearLine[3];
          const event = yearLine[4].trim();
          out.push(`${indent}section ${year}`);
          out.push(`${indent}  ${event}`);
          repairs.push(`Converted bare year line → section format: "${year}"`);
        } else {
          out.push(line);
        }
      }
      fixed = out.join("\n");
    }

    return { code: fixed, repairs };
  },
);

export const requirementDiagramRepairPass: RepairPass = makePass(
  "requirement-repair",
  ["requirementDiagram"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!fixed.toLowerCase().startsWith("requirementdiagram")) {
      fixed = "requirementDiagram\n" + fixed;
      repairs.push('Injected missing "requirementDiagram" header');
    }

    const opens = (fixed.match(/\{/g) ?? []).length;
    const closes = (fixed.match(/\}/g) ?? []).length;
    if (opens > closes) {
      fixed +=
        "\n" +
        Array(opens - closes)
          .fill("}")
          .join("\n");
      repairs.push(
        `Added ${opens - closes} missing closing "}" in requirementDiagram`,
      );
    }

    return { code: fixed, repairs };
  },
);

export const journeyRepairPass: RepairPass = makePass(
  "journey-repair",
  ["journey"],
  (code) => {
    const repairs: string[] = [];
    let fixed = code;

    if (!fixed.toLowerCase().startsWith("journey")) {
      fixed = "journey\n" + fixed;
      repairs.push('Injected missing "journey" header');
    }

    const lines = fixed.split("\n");
    const out: string[] = [];
    for (const line of lines) {
      const taskMatch = line.match(/^(\s+)(\w[^:]+):\s*(\d+)\s*$/);
      if (taskMatch) {
        out.push(`${taskMatch[1]}${taskMatch[2]}: ${taskMatch[3]}: Me`);
        repairs.push(
          `Added missing actor to journey task: "${taskMatch[2].trim()}"`,
        );
      } else {
        out.push(line);
      }
    }
    fixed = out.join("\n");

    return { code: fixed, repairs };
  },
);

export const BUILTIN_PASSES: RepairPass[] = [
  keywordNormalizationPass,
  betaSuffixPass,
  flowchartRepairPass,
  sequenceDiagramRepairPass,
  classDiagramRepairPass,
  stateDiagramRepairPass,
  gitGraphRepairPass,
  erDiagramRepairPass,
  ganttRepairPass,
  mindmapRepairPass,
  sankeyRepairPass,
  quadrantRepairPass,
  timelineRepairPass,
  requirementDiagramRepairPass,
  journeyRepairPass,
];
