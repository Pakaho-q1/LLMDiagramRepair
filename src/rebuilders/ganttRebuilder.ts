// rebuilders/ganttRebuilder.ts
import type { RepairContext, RepairResult, DiagramKind } from '../types/index.js';

interface GanttTask { id?: string; label: string; status?: string; startDate?: string; duration?: string; endDate?: string; after?: string; crit?: boolean; done?: boolean; active?: boolean; milestone?: boolean; }
interface GanttSection { name: string; tasks: GanttTask[]; }
interface GanttModel { title: string; dateFormat: string; axisFormat?: string; todayMarker?: string; includes?: string[]; excludes?: string[]; sections: GanttSection[]; }

function stripQuotes(s: string) { return s.replace(/^["'`]|["'`]$/g, '').trim(); }

const DATE_RE = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
const DUR_RE = /^\d+[dwmhs]$/i;

function normalizeDate(s: string): string {
  return s.replace(/\//g, '-');
}

export function parseLooseGantt(code: string): GanttModel | null {
  const lines = code.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const isGantt = /^(gantt|ganttChart|gantt[-_]chart|Gantt)/i.test(lines[0]);
  if (!isGantt) return null;

  const model: GanttModel = { title: '', dateFormat: 'YYYY-MM-DD', sections: [] };
  let currentSection: GanttSection = { name: 'Tasks', tasks: [] };
  model.sections.push(currentSection);
  let hasSectionHeader = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('%%')) continue;

    if (/^title\s+/i.test(line)) { model.title = line.replace(/^title\s+/i, '').trim(); continue; }
    if (/^dateFormat\s+/i.test(line)) { model.dateFormat = line.replace(/^dateFormat\s+/i, '').trim(); continue; }
    if (/^axisFormat\s+/i.test(line)) { model.axisFormat = line.replace(/^axisFormat\s+/i, '').trim(); continue; }
    if (/^todayMarker\s+/i.test(line)) { model.todayMarker = line.replace(/^todayMarker\s+/i, '').trim(); continue; }
    if (/^(excludes|includes)\s+/i.test(line)) { continue; } // keep as-is later

    if (/^section\s+/i.test(line)) {
      hasSectionHeader = true;
      currentSection = { name: line.replace(/^section\s+/i, '').trim(), tasks: [] };
      model.sections.push(currentSection);
      continue;
    }

    // task: label : [crit,] [done|active,] [id,] start, duration
    // OR: label : start - end
    const taskMatch = line.match(/^([^:]+?)\s*:\s*(.+)$/);
    if (taskMatch) {
      const label = stripQuotes(taskMatch[1].trim());
      const rest = taskMatch[2].trim();
      const parts = rest.split(/\s*,\s*/);

      const task: GanttTask = { label };

      for (const part of parts) {
        const p = part.trim();
        if (p === 'crit') { task.crit = true; continue; }
        if (p === 'done') { task.done = true; continue; }
        if (p === 'active') { task.active = true; continue; }
        if (p === 'milestone') { task.milestone = true; continue; }
        if (/^after\s+\w+/i.test(p)) { task.after = p.replace(/^after\s+/i, ''); continue; }
        if (/^\w+\d+$/.test(p) && !DATE_RE.test(p) && !DUR_RE.test(p)) { task.id = p; continue; }
        if (DATE_RE.test(normalizeDate(p))) {
          if (!task.startDate) task.startDate = normalizeDate(p);
          else task.endDate = normalizeDate(p);
          continue;
        }
        if (DUR_RE.test(p)) { task.duration = p; continue; }
      }

      currentSection.tasks.push(task);
    }
  }

  const totalTasks = model.sections.reduce((s, sec) => s + sec.tasks.length, 0);
  if (!totalTasks) return null;
  return model;
}

export function buildGantt(model: GanttModel): string {
  const lines = ['gantt'];
  if (model.title) lines.push(`  title ${model.title}`);
  lines.push(`  dateFormat ${model.dateFormat}`);
  if (model.axisFormat) lines.push(`  axisFormat ${model.axisFormat}`);

  for (const section of model.sections) {
    if (section.tasks.length === 0) continue;
    if (model.sections.length > 1 || model.sections[0].name !== 'Tasks') {
      lines.push(`  section ${section.name}`);
    }
    for (const task of section.tasks) {
      const flags: string[] = [];
      if (task.crit) flags.push('crit');
      if (task.done) flags.push('done');
      if (task.active) flags.push('active');
      if (task.milestone) flags.push('milestone');
      if (task.id) flags.push(task.id);
      if (task.after) flags.push(`after ${task.after}`);
      if (task.startDate) flags.push(task.startDate);
      if (task.endDate) flags.push(task.endDate);
      else if (task.duration) flags.push(task.duration);
      lines.push(`  ${task.label} : ${flags.join(', ')}`);
    }
  }
  return lines.join('\n');
}

export const ganttRebuilderPass = {
  name: 'gantt-rebuilder',
  isRebuilder: true,
  appliesTo: ['gantt'] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseGantt(ctx.code);
    if (!model) return { passName: this.name, changed: false, code: ctx.code, repairs: [] };
    const rebuilt = buildGantt(model);
    const changed = rebuilt !== ctx.code;
    const tasks = model.sections.reduce((s, sec) => s + sec.tasks.length, 0);
    return { passName: this.name, changed, code: rebuilt, repairs: changed ? [`Rebuilt gantt (${tasks} tasks, ${model.sections.length} sections)`] : [] };
  },
};
