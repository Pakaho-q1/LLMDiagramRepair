import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface JourneyTask {
  name: string;
  score: number;
  actors: string[];
}
interface JourneySection {
  name: string;
  tasks: JourneyTask[];
}
interface JourneyModel {
  title: string;
  sections: JourneySection[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

export function parseLooseJourney(code: string): JourneyModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isJourney =
    /^(journey|userJourney|user[-_]journey|User Journey|customerJourney|customer[-_]journey)/i.test(
      lines[0],
    );
  if (!isJourney) return null;

  const model: JourneyModel = { title: "", sections: [] };
  let currentSection: JourneySection = { name: "Journey", tasks: [] };
  model.sections.push(currentSection);

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
        tasks: [],
      };
      model.sections.push(currentSection);
      continue;
    }

    const taskFull = line.match(/^([^:]+?)\s*:\s*(\d+)\s*:\s*(.+)$/);
    if (taskFull) {
      const actors = taskFull[3]
        .split(",")
        .map((a) => stripQuotes(a.trim()))
        .filter(Boolean);
      currentSection.tasks.push({
        name: stripQuotes(taskFull[1]),
        score: parseInt(taskFull[2]),
        actors,
      });
      continue;
    }

    const taskNoActor = line.match(/^([^:]+?)\s*:\s*(\d+)\s*$/);
    if (taskNoActor) {
      currentSection.tasks.push({
        name: stripQuotes(taskNoActor[1]),
        score: parseInt(taskNoActor[2]),
        actors: ["Me"],
      });
      continue;
    }

    const looseTask = line.match(/^(.+?)\s*\((\d+)\)\s*(.*)$/);
    if (looseTask) {
      const actors = looseTask[3]
        ? looseTask[3].split(/[,\s]+/).filter(Boolean)
        : ["Me"];
      currentSection.tasks.push({
        name: stripQuotes(looseTask[1].trim()),
        score: parseInt(looseTask[2]),
        actors,
      });
      continue;
    }
  }

  const totalTasks = model.sections.reduce((s, sec) => s + sec.tasks.length, 0);
  if (!totalTasks) return null;
  return model;
}

export function buildJourney(model: JourneyModel): string {
  const lines = ["journey"];
  if (model.title) lines.push(`  title ${model.title}`);
  for (const section of model.sections) {
    if (model.sections.length > 1 || section.name !== "Journey")
      lines.push(`  section ${section.name}`);
    for (const task of section.tasks) {
      lines.push(`    ${task.name}: ${task.score}: ${task.actors.join(", ")}`);
    }
  }
  return lines.join("\n");
}

export const journeyRebuilderPass = {
  name: "journey-rebuilder",
  isRebuilder: true,
  appliesTo: ["journey"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseJourney(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildJourney(model);
    const changed = rebuilt !== ctx.code;
    const tasks = model.sections.reduce((s, sec) => s + sec.tasks.length, 0);
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt journey (${tasks} tasks, ${model.sections.length} sections)`,
          ]
        : [],
    };
  },
};
