// rebuilders/timelineRebuilder.ts
import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface TimelineEvent {
  text: string;
}
interface TimelinePeriod {
  label: string;
  events: TimelineEvent[];
}
interface TimelineSection {
  name?: string;
  periods: TimelinePeriod[];
}
interface TimelineModel {
  title: string;
  sections: TimelineSection[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

export function parseLooseTimeline(code: string): TimelineModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isTimeline = /^(timeline|Timeline|time[-_]line)/i.test(lines[0]);
  if (!isTimeline) return null;

  const model: TimelineModel = { title: "", sections: [] };
  let currentSection: TimelineSection = { periods: [] };
  model.sections.push(currentSection);
  let currentPeriod: TimelinePeriod | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%")) continue;

    if (/^title\s+/i.test(line)) {
      model.title = line.replace(/^title\s+/i, "").trim();
      continue;
    }

    if (/^section\s+/i.test(line)) {
      currentSection = {
        name: line.replace(/^section\s+/i, "").trim(),
        periods: [],
      };
      model.sections.push(currentSection);
      currentPeriod = null;
      continue;
    }

    if (line.startsWith(": ") || line.startsWith(":")) {
      const text = line.replace(/^:\s*/, "").trim();
      if (currentPeriod && text) {
        currentPeriod.events.push({ text });
        continue;
      }
    }

    const colonIdx = line.indexOf(" : ");
    if (colonIdx > 0) {
      const periodLabel = line.slice(0, colonIdx).trim();
      const eventText = line.slice(colonIdx + 3).trim();
      currentPeriod = { label: stripQuotes(periodLabel), events: [] };
      currentSection.periods.push(currentPeriod);
      if (eventText) currentPeriod.events.push({ text: eventText });
      continue;
    }

    const isPeriod =
      /^\d{4}|^Q[1-4]\s+\d{4}|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(
        line,
      ) ||
      (currentPeriod === null && line.length < 40);

    if (isPeriod) {
      currentPeriod = { label: stripQuotes(line), events: [] };
      currentSection.periods.push(currentPeriod);
      continue;
    }

    if (currentPeriod) {
      currentPeriod.events.push({ text: line });
    } else {
      currentPeriod = { label: line, events: [] };
      currentSection.periods.push(currentPeriod);
    }
  }

  const totalPeriods = model.sections.reduce(
    (s, sec) => s + sec.periods.length,
    0,
  );
  if (!totalPeriods) return null;
  return model;
}

export function buildTimeline(model: TimelineModel): string {
  const lines = ["timeline"];
  if (model.title) lines.push(`  title ${model.title}`);

  for (const section of model.sections) {
    if (section.name) lines.push(`  section ${section.name}`);
    for (const period of section.periods) {
      if (period.events.length === 0) {
        lines.push(`  ${period.label}`);
      } else if (period.events.length === 1) {
        lines.push(`  ${period.label} : ${period.events[0].text}`);
      } else {
        lines.push(`  ${period.label} : ${period.events[0].text}`);
        for (let j = 1; j < period.events.length; j++) {
          lines.push(`             : ${period.events[j].text}`);
        }
      }
    }
  }

  return lines.join("\n");
}

export const timelineRebuilderPass = {
  name: "timeline-rebuilder",
  isRebuilder: true,
  appliesTo: ["timeline"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseTimeline(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildTimeline(model);
    const changed = rebuilt !== ctx.code;
    const periods = model.sections.reduce(
      (s, sec) => s + sec.periods.length,
      0,
    );
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed ? [`Rebuilt timeline (${periods} periods)`] : [],
    };
  },
};
