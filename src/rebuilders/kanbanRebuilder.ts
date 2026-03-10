import type {
  RepairContext,
  RepairResult,
  DiagramKind,
} from "../types/index.js";

interface KanbanCard {
  id?: string;
  label: string;
  assigned?: string;
}
interface KanbanColumn {
  label: string;
  cards: KanbanCard[];
}
interface KanbanModel {
  columns: KanbanColumn[];
}

function stripQuotes(s: string) {
  return s.replace(/^["'`]|["'`]$/g, "").trim();
}

export function parseLooseKanban(code: string): KanbanModel | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const isKanban = /^(kanban|Kanban|kanban[-_]board|KanbanBoard)/i.test(
    lines[0],
  );
  if (!isKanban) return null;

  const model: KanbanModel = { columns: [] };
  let currentColumn: KanbanColumn | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("%%")) continue;

    const sectionMatch = line.match(/^(?:section|##?\s*)\s*(.+)$/i);
    if (sectionMatch) {
      currentColumn = { label: stripQuotes(sectionMatch[1]), cards: [] };
      model.columns.push(currentColumn);
      continue;
    }

    const colBracket = line.match(/^(\w+)\["([^"]+)"\]\s*$/);
    if (colBracket) {
      currentColumn = { label: colBracket[2], cards: [] };
      model.columns.push(currentColumn);
      continue;
    }

    const itemMatch = line.match(/^[-*•]\s+(.+)$/);
    if (itemMatch) {
      const text = stripQuotes(itemMatch[1]);
      if (!currentColumn) {
        currentColumn = { label: "Backlog", cards: [] };
        model.columns.push(currentColumn);
      }
      currentColumn.cards.push({ label: text });
      continue;
    }

    const cardBracket = line.match(/^(\w+)\["([^"]+)"\]\s*$/);
    if (cardBracket && currentColumn) {
      currentColumn.cards.push({ id: cardBracket[1], label: cardBracket[2] });
      continue;
    }

    if (line.startsWith("@{") || line.startsWith("}")) continue;

    if (!currentColumn) {
      currentColumn = { label: stripQuotes(line), cards: [] };
      model.columns.push(currentColumn);
    } else if (line.length < 80 && !/^[|{}\[\]]/.test(line)) {
      currentColumn.cards.push({ label: stripQuotes(line) });
    }
  }

  if (!model.columns.length) return null;
  return model;
}

export function buildKanban(model: KanbanModel): string {
  const lines = ["kanban"];
  for (const col of model.columns) {
    const colId =
      col.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "") || "col";
    lines.push(`  ${colId}["${col.label}"]`);
    for (const card of col.cards) {
      const cardId =
        card.id ??
        col.label.slice(0, 3) + Math.random().toString(36).slice(2, 6);
      lines.push(`    ${cardId}["${card.label}"]`);
    }
  }
  return lines.join("\n");
}

export const kanbanRebuilderPass = {
  name: "kanban-rebuilder",
  isRebuilder: true,
  appliesTo: ["kanban"] as DiagramKind[],
  repair(ctx: RepairContext): RepairResult {
    const model = parseLooseKanban(ctx.code);
    if (!model)
      return {
        passName: this.name,
        changed: false,
        code: ctx.code,
        repairs: [],
      };
    const rebuilt = buildKanban(model);
    const changed = rebuilt !== ctx.code;
    const cards = model.columns.reduce((s, c) => s + c.cards.length, 0);
    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [`Rebuilt kanban (${model.columns.length} columns, ${cards} cards)`]
        : [],
    };
  },
};
