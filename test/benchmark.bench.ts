/**
 * benchmark.bench.ts
 * ทดสอบประสิทธิภาพ (Performance / Load Testing) ของ Pipeline
 * รันด้วยคำสั่ง: npx vitest bench
 */

import { bench, describe } from 'vitest';
import { transformMermaidFull } from '../src/index.js';

// ─────────────────────────────────────────────
// Helpers สำหรับสร้าง Diagram ขนาดใหญ่
// ─────────────────────────────────────────────

function generateLargeFlowchart(nodes: number, broken: boolean = false): string {
  let code = broken ? 'graph TD\n' : 'flowchart TD\n';
  const arrow = broken ? '--->' : '-->';
  for (let i = 0; i < nodes; i++) {
    code += `  Node${i}[Label ${i}] ${arrow} Node${i + 1}[Label ${i + 1}]\n`;
  }
  return code;
}

function generateLargeSequence(messages: number, broken: boolean = false): string {
  let code = broken ? 'sequence\n' : 'sequenceDiagram\n';
  const arrow = broken ? '->' : '->>';
  for (let i = 0; i < messages; i++) {
    code += `  Service${i}${arrow}Service${i + 1}: Call API ${i}\n`;
  }
  return code;
}

function generateLargeClassDiagram(classes: number, broken: boolean = false): string {
  let code = broken ? 'classDiagram-v2\n' : 'classDiagram\n';
  for (let i = 0; i < classes; i++) {
    if (broken) {
      code += `  class Class${i} extends Class${i + 1}\n`;
    } else {
      code += `  class Class${i}\n  Class${i + 1} <|-- Class${i}\n`;
    }
  }
  return code;
}

function generateLargeState(states: number, broken: boolean = false): string {
  let code = broken ? 'stateDiagram\n' : 'stateDiagram-v2\n';
  for (let i = 0; i < states; i++) {
    code += `  State${i} --> State${i + 1}\n`;
  }
  return code;
}

function generateLargeGantt(tasks: number, broken: boolean = false): string {
  // จำลองกรณี LLM ลืมใส่ dateFormat ซึ่งต้องถูกซ่อมโดยการ Inject เข้าไป
  let code = broken 
    ? 'Gantt Chart\ntitle Project Plan\nsection Phase 1\n' 
    : 'gantt\ndateFormat YYYY-MM-DD\ntitle Project Plan\nsection Phase 1\n';
  for (let i = 0; i < tasks; i++) {
    code += `  Task ${i} : a${i}, 2024-01-01, 1d\n`;
  }
  return code;
}

function generateLargePie(slices: number, broken: boolean = false): string {
  // จำลองกรณีใช้ keyword ผิดและลืมใส่ Quote ครอบ string
  let code = broken ? 'pieChart\n' : 'pie\n';
  for (let i = 0; i < slices; i++) {
    if (broken) {
      code += `  Slice${i} : 10\n`;
    } else {
      code += `  "Slice${i}" : 10\n`;
    }
  }
  return code;
}

// ─────────────────────────────────────────────
// Benchmark Suites
// ─────────────────────────────────────────────
describe('Diagram Parsing & Repairing Performance (Massive 1,000 items)', () => {

  // สร้าง Mock Data ขนาด 1,000 elements ไว้ใน Memory เพื่อไม่ให้เสียเวลาสร้างตอนเทส
  const massiveFlowchartClean = generateLargeFlowchart(1000, false);
  const massiveFlowchartBroken = generateLargeFlowchart(1000, true);
  
  const massiveSequenceBroken = generateLargeSequence(1000, true);
  const massiveClassBroken = generateLargeClassDiagram(1000, true);
  const massiveStateBroken = generateLargeState(1000, true);
  const massiveGanttBroken = generateLargeGantt(1000, true);
  const massivePieBroken = generateLargePie(1000, true);

  // 1. Flowchart (มีการวนเช็ก Label และ Arrow)
  bench('Flowchart (1,000 nodes) - Clean', () => {
    transformMermaidFull(massiveFlowchartClean);
  });

  bench('Flowchart (1,000 nodes) - Broken', () => {
    transformMermaidFull(massiveFlowchartBroken);
  });

  // 2. Sequence Diagram (มีการเช็ก Arrow ->>, alt, loop)
  bench('Sequence Diagram (1,000 messages) - Broken', () => {
    transformMermaidFull(massiveSequenceBroken);
  });

  // 3. Class Diagram (เช็ก extends/implements และ syntax v2)
  bench('Class Diagram (1,000 classes) - Broken', () => {
    transformMermaidFull(massiveClassBroken);
  });

  // 4. State Diagram (อัปเกรดเป็น stateDiagram-v2)
  bench('State Diagram (1,000 states) - Broken', () => {
    transformMermaidFull(massiveStateBroken);
  });

  // 5. Gantt Chart (เช็กและเติม dateFormat)
  bench('Gantt Chart (1,000 tasks) - Broken', () => {
    transformMermaidFull(massiveGanttBroken);
  });

  // 6. Pie Chart (เติม Quotes และซ่อม Keyword)
  bench('Pie Chart (1,000 slices) - Broken', () => {
    transformMermaidFull(massivePieBroken);
  });

});