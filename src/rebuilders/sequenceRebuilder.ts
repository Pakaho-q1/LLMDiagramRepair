// ============================================================
// rebuilders/sequenceRebuilder.ts
// Deterministic Rebuild สำหรับ Sequence Diagram
// รองรับ loose format ที่ LLM มักสร้าง
// ============================================================

import type { RepairContext, RepairResult } from '../types/index.js';

// ─────────────────────────────────────────────
// Data Model
// ─────────────────────────────────────────────

type ArrowType = '->>' | '-->' | '->>' | '-->>' | '-x' | '--)' | '->>' | 'x-->';

interface Participant {
  id: string;
  alias?: string;
  isActor: boolean;
}

type MessageArrow =
  | '->>'   // solid async
  | '-->>'  // dashed async
  | '->'    // solid sync (will be upgraded)
  | '-->'   // dashed sync
  | '-x'    // solid with X
  | '--x'   // dashed with X
  | '-)'    // solid open arrow
  | '--)'   // dashed open arrow

interface Message {
  from: string;
  to: string;
  arrow: MessageArrow;
  text: string;
  activate?: boolean;
  deactivate?: boolean;
}

interface Note {
  position: 'left of' | 'right of' | 'over';
  participants: string[];
  text: string;
}

type BlockKind = 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect';

interface Block {
  kind: BlockKind;
  condition?: string;
  items: SequenceItem[];
  elseItems?: SequenceItem[];
}

type SequenceItem = Message | Note | Block | { type: 'activate' | 'deactivate'; participant: string };

interface SequenceModel {
  participants: Participant[];
  items: SequenceItem[];
  title?: string;
}

// ─────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────

export function parseLooseSequence(code: string): SequenceModel | null {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  if (!lines.length) return null;

  const headerLine = lines[0].toLowerCase();
  const isSequence =
    /^(sequencediagram|sequence[-_]?diagram|seq[-_]?diagram|seqdiagram|seq\b)/.test(
      headerLine,
    );
  if (!isSequence) return null;

  const model: SequenceModel = {
    participants: [],
    items: [],
  };

  const participantOrder = new Map<string, Participant>();
  const stack: Block[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const current = stack.length > 0 ? stack[stack.length - 1] : null;
    const target = current ? current.items : model.items;

    // ── title ──────────────────────────────────
    const titleMatch = line.match(/^title[:\s]+(.+)$/i);
    if (titleMatch) {
      model.title = titleMatch[1].trim();
      continue;
    }

    // ── participant / actor ─────────────────────
    const participantMatch = line.match(/^(participant|actor)\s+(\w[\w\s]*?)(?:\s+as\s+(.+))?$/i);
    if (participantMatch) {
      const isActor = participantMatch[1].toLowerCase() === 'actor';
      const id = participantMatch[2].trim();
      const alias = participantMatch[3]?.trim();
      if (!participantOrder.has(id)) {
        const p: Participant = { id, alias, isActor };
        participantOrder.set(id, p);
        model.participants.push(p);
      }
      continue;
    }

    // ── activate / deactivate ───────────────────
    const activateMatch = line.match(/^(activate|deactivate)\s+(\w+)/i);
    if (activateMatch) {
      target.push({
        type: activateMatch[1].toLowerCase() as 'activate' | 'deactivate',
        participant: activateMatch[2],
      });
      continue;
    }

    // ── note ────────────────────────────────────
    const noteMatch = line.match(/^note\s+(left of|right of|over)\s+([\w,\s]+?)(?:\s*:\s*(.+))?$/i);
    if (noteMatch) {
      const participants = noteMatch[2].split(',').map((s) => s.trim());
      const note: Note = {
        position: noteMatch[1].toLowerCase() as Note['position'],
        participants,
        text: noteMatch[3]?.trim() || '',
      };
      target.push(note);
      ensureParticipants(participants, participantOrder, model);
      continue;
    }

    // ── block open: loop, alt, opt, par, critical, break ───
    const blockOpenMatch = line.match(/^(loop|alt|opt|par|critical|break|rect)\s*(.*)?$/i);
    if (blockOpenMatch) {
      const block: Block = {
        kind: blockOpenMatch[1].toLowerCase() as BlockKind,
        condition: blockOpenMatch[2]?.trim() || undefined,
        items: [],
      };
      stack.push(block);
      continue;
    }

    // ── else (inside alt) ────────────────────────
    if (/^else\s*/i.test(line)) {
      if (current && current.kind === 'alt') {
        current.elseItems = [];
      }
      continue;
    }

    // ── end ──────────────────────────────────────
    if (/^end\s*$/i.test(line)) {
      if (stack.length > 0) {
        const closed = stack.pop()!;
        const parent = stack.length > 0 ? stack[stack.length - 1].items : model.items;
        parent.push(closed);
      }
      continue;
    }

    // ── message ──────────────────────────────────
    // Patterns:
    //   A ->> B: text
    //   A -> B: text       (will normalize to ->>)
    //   A --> B: text
    //   A -->> B: text
    //   A -x B: text
    //   A -) B: text
    const msgMatch = line.match(
      /^([\w][\w\s]*?)\s*(->>|-->>|-->|->|-x|--x|-\)|--\))\s*([\w][\w\s]*?)\s*:\s*(.*)$/,
    );
    if (msgMatch) {
      const from = msgMatch[1].trim();
      const arrow = normalizeArrow(msgMatch[2] as MessageArrow);
      const to = msgMatch[3].trim();
      const text = msgMatch[4].trim();

      const msg: Message = { from, to, arrow, text };
      target.push(msg);

      // auto-register participants ที่ไม่ได้ประกาศ
      ensureParticipants([from, to], participantOrder, model);
      continue;
    }
  }

  // flush unclosed blocks
  while (stack.length > 0) {
    const closed = stack.pop()!;
    const parent = stack.length > 0 ? stack[stack.length - 1].items : model.items;
    parent.push(closed);
  }

  if (!model.items.length) return null;

  return model;
}

// ─────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────

export function buildSequence(model: SequenceModel): string {
  const lines: string[] = ['sequenceDiagram'];

  if (model.title) {
    lines.push(`  title: ${model.title}`);
  }

  for (const p of model.participants) {
    const keyword = p.isActor ? 'actor' : 'participant';
    const alias = p.alias ? ` as ${p.alias}` : '';
    lines.push(`  ${keyword} ${p.id}${alias}`);
  }

  buildItems(model.items, lines, '  ');

  return lines.join('\n');
}

function buildItems(items: SequenceItem[], lines: string[], indent: string) {
  for (const item of items) {
    if ('from' in item && 'to' in item && 'arrow' in item) {
      // Message
      const msg = item as Message;
      lines.push(`${indent}${msg.from}${msg.arrow}${msg.to}: ${msg.text}`);
    } else if ('position' in item) {
      // Note
      const note = item as Note;
      lines.push(
        `${indent}Note ${note.position} ${note.participants.join(',')}${note.text ? ': ' + note.text : ''}`,
      );
    } else if ('type' in item) {
      // activate/deactivate
      const act = item as { type: string; participant: string };
      lines.push(`${indent}${act.type} ${act.participant}`);
    } else if ('kind' in item) {
      // Block
      const block = item as Block;
      const condition = block.condition ? ` ${block.condition}` : '';
      lines.push(`${indent}${block.kind}${condition}`);
      buildItems(block.items, lines, indent + '  ');
      if (block.elseItems) {
        lines.push(`${indent}else`);
        buildItems(block.elseItems, lines, indent + '  ');
      }
      lines.push(`${indent}end`);
    }
  }
}

// ─────────────────────────────────────────────
// Repair Pass
// ─────────────────────────────────────────────

export const sequenceRebuilderPass = {
  name: 'sequence-rebuilder',
  appliesTo: ['sequenceDiagram'] as DiagramKind[],
  isRebuilder: true,

  repair(ctx: RepairContext): RepairResult {
    const { code } = ctx;
    const model = parseLooseSequence(code);

    if (!model) {
      return { passName: this.name, changed: false, code, repairs: [] };
    }

    const rebuilt = buildSequence(model);
    const changed = rebuilt !== code;

    return {
      passName: this.name,
      changed,
      code: rebuilt,
      repairs: changed
        ? [
            `Rebuilt sequenceDiagram (${model.participants.length} participants, ${countMessages(model.items)} messages)`,
          ]
        : [],
    };
  },
};

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function normalizeArrow(arrow: MessageArrow): MessageArrow {
  // อัพเกรด -> เป็น ->> (sync → async)
  if (arrow === '->' as any) return '->>';
  return arrow;
}

function ensureParticipants(
  ids: string[],
  map: Map<string, Participant>,
  model: SequenceModel,
) {
  for (const id of ids) {
    const clean = id.trim();
    if (clean && !map.has(clean)) {
      const p: Participant = { id: clean, isActor: false };
      map.set(clean, p);
      model.participants.push(p);
    }
  }
}

function countMessages(items: SequenceItem[]): number {
  let count = 0;
  for (const item of items) {
    if ('from' in item) count++;
    else if ('kind' in item) {
      count += countMessages((item as Block).items);
      if ((item as Block).elseItems) count += countMessages((item as Block).elseItems!);
    }
  }
  return count;
}
