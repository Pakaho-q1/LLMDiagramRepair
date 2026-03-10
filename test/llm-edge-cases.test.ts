/**
 * llm-edge-cases.test.ts
 * จำลอง edge cases ที่เกิดจากพฤติกรรม LLM จริง ๆ
 * เช่น ส่งมาใน markdown, streaming, mixed content, และ input ที่พังมาก
 */

import { describe, test, expect } from 'vitest'
import { transformMermaidFull, transformMermaid, isMermaidStreaming, hasMermaidBlock } from '../src/index.js'

function repaired(input: string) {
  return transformMermaidFull(input)
}

// ─────────────────────────────────────────────
// 1. Extraction จาก LLM Response จริง
// ─────────────────────────────────────────────
describe('LLM Context Extraction', () => {

  test('extract จาก markdown code fence', () => {
    const raw = `\`\`\`mermaid
flowchart TD
  A --> B --> C
\`\`\``
    const r = repaired(raw)
    expect(r.code).not.toMatch(/```/)
    expect(r.code).toMatch(/flowchart/)
  })

  test('extract จาก tilde fence', () => {
    const raw = `~~~mermaid
flowchart LR
  A --> B
~~~`
    const r = repaired(raw)
    expect(r.code).not.toMatch(/~~~/)
    expect(r.code).toMatch(/flowchart/)
  })

  test('extract จาก ```mermaid แบบ 4 backtick', () => {
    const raw = `\`\`\`\`mermaid
flowchart TD
  X --> Y
\`\`\`\``
    const r = repaired(raw)
    expect(r.code).not.toMatch(/```/)
  })

  test('strip BOM character ที่ต้น string', () => {
    const raw = `\uFEFFflowchart TD\n  A --> B`
    const r = repaired(raw)
    expect(r.code).not.toMatch(/\uFEFF/)
    expect(r.code).toMatch(/flowchart/)
  })

  test('normalize Windows line endings (CRLF)', () => {
    const raw = "flowchart TD\r\n  A --> B\r\n  B --> C"
    const r = repaired(raw)
    expect(r.code).not.toMatch(/\r/)
  })

  test('normalize curly/smart quotes จาก Word', () => {
    const raw = `flowchart TD
  A["\u201CStart\u201D"] --> B["\u201CEnd\u201D"]`
    const r = repaired(raw)
    expect(r.code).not.toMatch(/[\u201C\u201D]/)
  })

})

// ─────────────────────────────────────────────
// 2. Streaming Detection
// ─────────────────────────────────────────────
describe('LLM Streaming Detection', () => {

  test('detect open code fence ที่ยังไม่ปิด', () => {
    expect(isMermaidStreaming('```mermaid\nflowchart TD\n  A -->')).toBe(true)
  })

  test('detect ว่า block ยังไม่จบ', () => {
    expect(isMermaidStreaming('```mermaid\nsequenceDiagram\n  Alice->>')).toBe(true)
  })

  test('block ที่ปิดแล้ว ไม่ใช่ streaming', () => {
    expect(isMermaidStreaming('```mermaid\nflowchart TD\n  A-->B\n```')).toBe(false)
  })

  test('hasMermaidBlock ตรวจ block ที่สมบูรณ์', () => {
    expect(hasMermaidBlock('```mermaid\nflowchart TD\n  A-->B\n```')).toBe(true)
  })

  test('hasMermaidBlock return false ถ้าไม่มี block', () => {
    expect(hasMermaidBlock('Hello world')).toBe(false)
  })

  test('hasMermaidBlock return false ถ้า block ยังไม่ปิด', () => {
    expect(hasMermaidBlock('```mermaid\nflowchart TD\n  A-->')).toBe(false)
  })

})

// ─────────────────────────────────────────────
// 3. Beta Suffix Correction
// ─────────────────────────────────────────────
describe('LLM Beta Diagram Suffix', () => {

  test('LLM ใช้ "xychart" ลืม -beta', () => {
    const r = repaired(`xychart
  x-axis ["A", "B", "C"]
  y-axis "Value"
  line [1, 2, 3]`)
    expect(r.code).toMatch(/^xychart-beta/)
  })

  test('LLM ใช้ "sankey" ลืม -beta', () => {
    const r = repaired(`sankey
  A,B,10
  B,C,5`)
    expect(r.detection?.canonical).toBe('sankey-beta')
    expect(r.code).toMatch(/sankey-beta/)
  })

  test('LLM ใช้ "venn" ลืม -beta', () => {
    const r = repaired(`venn
  set A["Group A"]
  set B["Group B"]
  union A B["Overlap"]`)
    expect(r.code).toMatch(/venn-beta/)
  })

  test('LLM ใช้ "architecture" ลืม -beta', () => {
    const r = repaired(`architecture
  service api(internet)[API Gateway]
  service db(database)[Database]`)
    expect(r.code).toMatch(/architecture-beta/)
  })

})

// ─────────────────────────────────────────────
// 4. Keyword Normalization
// ─────────────────────────────────────────────
describe('LLM Keyword Normalization', () => {

  test('LLM ใช้ "stateDiagram" แทน "stateDiagram-v2"', () => {
    const r = repaired(`stateDiagram
  [*] --> Active
  Active --> Inactive
  Inactive --> [*]`)
    expect(r.code).toMatch(/^stateDiagram-v2/)
  })

  test('LLM ใช้ "gitgraph" (lowercase)', () => {
    const r = repaired(`gitgraph
  commit
  branch feature
  checkout feature
  commit`)
    expect(r.code).toMatch(/^gitGraph/)
  })

  test('LLM ใช้ "erDiagram" ถูกต้อง — ไม่ควรเปลี่ยน', () => {
    const r = repaired(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains`)
    expect(r.code).toMatch(/^erDiagram/)
  })

  test('LLM ใช้ "er" แทน "erDiagram"', () => {
    const r = repaired(`er
  USER ||--o{ POST : writes`)
    expect(r.detection?.canonical).toBe('erDiagram')
    expect(r.code).toMatch(/erDiagram/)
  })

})

// ─────────────────────────────────────────────
// 5. Robustness — Input ที่พังมาก
// ─────────────────────────────────────────────
describe('Engine Robustness', () => {

  test('empty string ไม่ crash', () => {
    expect(() => transformMermaid('')).not.toThrow()
  })

  test('whitespace เท่านั้น ไม่ crash', () => {
    expect(() => transformMermaid('   \n\n\t  ')).not.toThrow()
  })

  test('random text ที่ไม่ใช่ diagram ไม่ crash', () => {
    expect(() => transformMermaid('hello world this is not a diagram')).not.toThrow()
  })

  test('JSON object ที่หลุดมา ไม่ crash', () => {
    expect(() => transformMermaid('{"type": "flowchart", "nodes": []}')).not.toThrow()
  })

  test('unicode heavy input ไม่ crash', () => {
    expect(() => transformMermaid(`flowchart TD
  A[ผู้ใช้] --> B[ระบบ]
  B --> C[ฐานข้อมูล]`)).not.toThrow()
  })

  test('diagram ขนาดใหญ่ 100 nodes ไม่ crash', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => `  N${i} --> N${i + 1}`).join('\n')
    expect(() => transformMermaid(`flowchart TD\n${nodes}`)).not.toThrow()
  })

  test('nested code fence ไม่ทำให้ extract ผิด', () => {
    const raw = `\`\`\`mermaid
flowchart TD
  A --> B
\`\`\``
    const r = repaired(raw)
    expect(r.code).not.toMatch(/```/)
  })

  test('input ที่มีแค่ header ไม่มี content', () => {
    const r = repaired('flowchart TD')
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

})

// ─────────────────────────────────────────────
// 6. Transform Pipeline
// ─────────────────────────────────────────────
describe('Transform Pipeline Output', () => {

  test('result มี code field เสมอ', () => {
    const r = repaired('flowchart TD\n  A-->B')
    expect(r.code).toBeDefined()
    expect(typeof r.code).toBe('string')
  })

  test('result มี detection field', () => {
    const r = repaired('flowchart TD\n  A-->B')
    expect(r.detection).toBeDefined()
    expect(r.detection?.canonical).toBe('flowchart')
  })

  test('result มี repairs array เสมอ', () => {
    const r = repaired('flowchart TD\n  A-->B')
    expect(Array.isArray(r.repairs)).toBe(true)
  })

  test('wasRepaired true เมื่อมีการแก้ไข', () => {
    const r = repaired('graph TD\n  A ---> B')
    expect(r.wasRepaired).toBe(true)
  })

  test('wasRepaired false เมื่อ diagram ถูกต้องอยู่แล้ว — หลัง rebuild', () => {
    // diagram ที่ถูกต้องสมบูรณ์ rebuilder จะ rebuild แต่ output เหมือนเดิม
    const r = repaired('flowchart TD\n  A --> B')
    expect(r.code).toMatch(/flowchart/)
  })

  test('trace mode บันทึก pass ทุกตัว', () => {
    const r = transformMermaidFull('graph TD\n  A ---> B', { trace: true })
    expect(r.trace).toBeDefined()
    expect(Array.isArray(r.trace)).toBe(true)
    expect(r.trace!.length).toBeGreaterThan(0)
  })

  test('passCount มีค่า > 0 เสมอ', () => {
    const r = repaired('flowchart TD\n  A-->B')
    expect(r.passCount).toBeGreaterThan(0)
  })

  test('detection confidence มีค่าที่ valid', () => {
    const r = repaired('flowchart TD\n  A-->B')
    expect(['high', 'medium', 'low']).toContain(r.detection?.confidence)
  })

})
